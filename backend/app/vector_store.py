import uuid

from qdrant_client import QdrantClient

from qdrant_client.models import (

    Distance,

    VectorParams,

    PointStruct

)

from app.config import settings

_client = None

def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
        )
    return _client

def ensure_collection(vector_size: int):

    client = _get_client()
    collections = [
        c.name
        for c in client.get_collections().collections
    ]

    if settings.qdrant_collection not in collections:

        client.create_collection(

            collection_name=settings.qdrant_collection,

            vectors_config=VectorParams(

                size=vector_size,

                distance=Distance.COSINE

            )

        )

def upsert_chunks(

    document_id: str,

    filename: str,

    chunks: list[str],

    vectors: list[list[float]]

):

    points = [

        PointStruct(

            id=str(uuid.uuid4()),

            vector=vector,

            payload={

                "document_id": document_id,

                "filename": filename,

                "text": chunk

            }

        )

        for chunk, vector in zip(chunks, vectors)

    ]

    _get_client().upsert(

        collection_name=settings.qdrant_collection,

        points=points

    )

def search(

    query_vector: list[float],

    top_k: int,

    document_id: str | None = None

):

    query_filter = None

    if document_id:

        from qdrant_client.models import (

            Filter,

            FieldCondition,

            MatchValue

        )

        query_filter = Filter(

            must=[

                FieldCondition(

                    key="document_id",

                    match=MatchValue(

                        value=document_id

                    )

                )

            ]

        )

    return _get_client().search(

        collection_name=settings.qdrant_collection,

        query_vector=query_vector,

        limit=top_k,

        query_filter=query_filter

    )