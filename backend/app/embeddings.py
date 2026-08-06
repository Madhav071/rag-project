import httpx

import asyncio

from app.config import settings


async def embed_text(text: str) -> list[float]:

    async with httpx.AsyncClient(timeout=30.0) as client:

        resp = await client.post(

            f"{settings.ollama_host}/api/embeddings",

            json={

                "model": settings.embedding_model,

                "prompt": text

            }

        )

        resp.raise_for_status()

        return resp.json()["embedding"]


async def embed_batch(texts: list[str]) -> list[list[float]]:

    sem = asyncio.Semaphore(5)

    async def _one(text: str):

        async with sem:

            return await embed_text(text)

    return await asyncio.gather(

        *[_one(text) for text in texts]

    )