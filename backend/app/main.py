import uuid

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.extraction import extract_text
from app.chunking import chunk_text
from app.embeddings import embed_text, embed_batch
from app.vector_store import ensure_collection, upsert_chunks, search
from app.llm import generate_answer
from app.schemas import UploadResponse, AskRequest, AskResponse

app = FastAPI(title="RAG Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    content = await file.read()

    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            413,
            f"File exceeds {settings.max_upload_mb}MB limit"
        )

    try:
        text = extract_text(
            file.filename,
            content
        )
    except ValueError as e:
        raise HTTPException(
            400,
            str(e)
        )

    chunks = chunk_text(text)

    if not chunks:
        raise HTTPException(
            400,
            "No extractable text found in document"
        )

    vectors = await embed_batch(chunks)

    ensure_collection(
        vector_size=len(vectors[0])
    )

    document_id = str(uuid.uuid4())

    upsert_chunks(
        document_id,
        file.filename,
        chunks,
        vectors
    )

    return UploadResponse(
        document_id=document_id,
        filename=file.filename,
        chunks_indexed=len(chunks)
    )


@app.post("/ask", response_model=AskResponse)
async def ask_question(req: AskRequest):
    query_vector = await embed_text(req.question)

    results = search(
        query_vector,
        top_k=settings.top_k,
        document_id=req.document_id
    )

    if not results:
        return AskResponse(
            answer="No relevant content found.",
            sources=[]
        )

    context_chunks = [
        r.payload["text"]
        for r in results
    ]

    sources = list(
        {
            r.payload["filename"]
            for r in results
        }
    )

    answer = await generate_answer(
        req.question,
        context_chunks
    )

    return AskResponse(
        answer=answer,
        sources=sources
    )