import httpx

from app.config import settings


async def generate_answer(

    question: str,

    context_chunks: list[str]

) -> str:

    context = "\n\n---\n\n".join(context_chunks)

    prompt = f"""Answer the question using only the context below. If the context doesn't contain the answer, say so.

Context:
{context}

Question: {question}

Answer:"""

    async with httpx.AsyncClient(timeout=120.0) as client:

        resp = await client.post(

            f"{settings.ollama_host}/api/generate",

            json={

                "model": settings.llm_model,

                "prompt": prompt,

                "stream": False

            }

        )

        resp.raise_for_status()

        return resp.json()["response"]