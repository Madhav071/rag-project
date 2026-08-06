from app.config import settings


def chunk_text(text: str) -> list[str]:

    size = settings.chunk_size

    overlap = settings.chunk_overlap

    text = text.strip()

    if not text:

        return []

    chunks = []

    start = 0

    while start < len(text):

        end = start + size

        chunks.append(text[start:end])

        start += size - overlap

    return chunks