/* ============================================================
   Paperstack — Application Logic
   ============================================================ */

(function () {
  'use strict';

  // ---- Configuration ----
  const API_BASE = window.PAPERSTACK_API || 'http://localhost:8000';

  // ---- State ----
  let currentDocumentId = null;
  let currentFilename = null;
  let isUploading = false;
  let isAsking = false;

  // ---- Allowed file types & size ----
  const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'txt'];
  const MAX_SIZE_MB = 25;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  // ---- DOM refs ----
  const uploadZone      = document.getElementById('upload-zone');
  const fileInput        = document.getElementById('file-input');
  const uploadStatus     = document.getElementById('upload-status');
  const statusIcon       = document.getElementById('status-icon');
  const statusText       = document.getElementById('status-text');
  const docBanner        = document.getElementById('doc-banner');
  const docName          = document.getElementById('doc-name');
  const docMeta          = document.getElementById('doc-meta');
  const changeBtn        = document.getElementById('change-doc-btn');
  const askSection       = document.getElementById('ask-section');
  const askForm          = document.getElementById('ask-form');
  const askInput         = document.getElementById('ask-input');
  const askBtn           = document.getElementById('ask-btn');
  const qaThread         = document.getElementById('qa-thread');
  const emptyState       = document.getElementById('empty-state');
  const toastEl          = document.getElementById('toast');

  // ---- File validation ----
  function getExtension(filename) {
    return (filename || '').toLowerCase().split('.').pop();
  }

  function validateFile(file) {
    if (!file) return 'No file selected.';
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Can't read .${ext} files — try a PDF, DOCX, PPTX, or plain text file.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `That file is too large (limit is ${MAX_SIZE_MB} MB).`;
    }
    return null;
  }

  // ---- Toast notifications ----
  let toastTimer = null;
  function showToast(message, type) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.className = 'toast toast-' + type + ' visible';
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 4000);
  }

  // ---- Upload status ----
  function setUploadStatus(state, message) {
    uploadStatus.className = 'upload-status visible ' + state;
    statusText.textContent = message;
    if (state === 'loading') {
      statusIcon.innerHTML = '<span class="spinner"></span>';
    } else if (state === 'success') {
      statusIcon.textContent = '✓';
    } else if (state === 'error') {
      statusIcon.textContent = '✗';
    }
  }

  function hideUploadStatus() {
    uploadStatus.className = 'upload-status';
  }

  // ---- Upload flow ----
  async function uploadFile(file) {
    const error = validateFile(file);
    if (error) {
      setUploadStatus('error', error);
      return;
    }

    isUploading = true;
    setUploadStatus('loading', 'Reading your document…');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const msg = body.detail || `Upload failed (${resp.status})`;
        throw new Error(msg);
      }

      const data = await resp.json();
      currentDocumentId = data.document_id;
      currentFilename = data.filename;

      setUploadStatus('success', `"${data.filename}" is ready — ${data.chunks_indexed} sections indexed`);
      showDocBanner(data.filename, data.chunks_indexed);
      showAskSection();
      clearQAThread();

    } catch (err) {
      const message = err.message.includes('Failed to fetch')
        ? 'Couldn't reach the server — is the backend running?'
        : err.message;
      setUploadStatus('error', message);
    } finally {
      isUploading = false;
      // Reset file input so the same file can be re-uploaded
      fileInput.value = '';
    }
  }

  // ---- Doc banner ----
  function showDocBanner(filename, chunks) {
    docName.textContent = filename;
    docMeta.textContent = `${chunks} section${chunks !== 1 ? 's' : ''} indexed`;
    docBanner.classList.add('visible');
  }

  function hideDocBanner() {
    docBanner.classList.remove('visible');
    currentDocumentId = null;
    currentFilename = null;
  }

  // ---- Ask section ----
  function showAskSection() {
    askSection.classList.add('visible');
    askInput.focus();
  }

  function hideAskSection() {
    askSection.classList.remove('visible');
  }

  function clearQAThread() {
    qaThread.innerHTML = '';
    emptyState.style.display = 'block';
  }

  // ---- Ask flow ----
  async function askQuestion(question) {
    if (isAsking || !question.trim()) return;

    isAsking = true;
    askBtn.disabled = true;
    askInput.disabled = true;
    emptyState.style.display = 'none';

    // Add question to thread
    const pairEl = document.createElement('div');
    pairEl.className = 'qa-pair';
    pairEl.innerHTML = `
      <div class="qa-question">
        <span class="qa-question-label">Q:</span>
        <span>${escapeHtml(question)}</span>
      </div>
    `;

    // Add thinking indicator
    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'thinking';
    thinkingEl.innerHTML = `
      <div class="thinking-dots"><span></span><span></span><span></span></div>
      Leafing through the pages…
    `;
    pairEl.appendChild(thinkingEl);
    qaThread.appendChild(pairEl);
    pairEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

    try {
      const payload = { question: question.trim() };
      if (currentDocumentId) {
        payload.document_id = currentDocumentId;
      }

      const resp = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Something went wrong (${resp.status})`);
      }

      const data = await resp.json();

      // Replace thinking with answer
      thinkingEl.remove();
      const answerEl = createAnswerCard(data.answer, data.sources);
      pairEl.appendChild(answerEl);

    } catch (err) {
      thinkingEl.remove();
      const message = err.message.includes('Failed to fetch')
        ? 'Couldn't reach the server — is the backend running?'
        : err.message;
      const errorEl = document.createElement('div');
      errorEl.className = 'answer-card';
      errorEl.style.borderLeftColor = 'var(--error)';
      errorEl.textContent = message;
      pairEl.appendChild(errorEl);
    } finally {
      isAsking = false;
      askBtn.disabled = false;
      askInput.disabled = false;
      askInput.value = '';
      askInput.focus();
    }
  }

  function createAnswerCard(answer, sources) {
    const card = document.createElement('div');
    card.className = 'answer-card';

    // Answer text
    const textEl = document.createElement('div');
    textEl.textContent = answer;
    card.appendChild(textEl);

    // Sources
    if (sources && sources.length > 0) {
      const sourcesEl = document.createElement('div');
      sourcesEl.className = 'answer-sources';
      sourcesEl.innerHTML = `<span class="answer-sources-label">Sources:</span>`;
      sources.forEach(src => {
        const chip = document.createElement('span');
        chip.className = 'source-chip';
        chip.textContent = src;
        sourcesEl.appendChild(chip);
      });
      card.appendChild(sourcesEl);
    }

    return card;
  }

  // ---- Helpers ----
  function escapeHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // ---- Event listeners ----

  // Drag & drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && !isUploading) {
      uploadFile(file);
    }
  });

  // Click-to-browse
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && !isUploading) {
      uploadFile(file);
    }
  });

  // Change document
  changeBtn.addEventListener('click', () => {
    hideDocBanner();
    hideAskSection();
    hideUploadStatus();
    clearQAThread();
    uploadZone.scrollIntoView({ behavior: 'smooth' });
  });

  // Ask form
  askForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const question = askInput.value.trim();
    if (question) {
      askQuestion(question);
    }
  });

  // Keyboard: Enter in input to submit (already handled by form submit)
  // Keyboard: allow dropping focus on Escape
  askInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      askInput.blur();
    }
  });

})();
