import uuid

from qdrant_client import QdrantClient

from qdrant_client.models import (

    Distance,

    VectorParams,

    PointStruct

)

from app.config import settings

_client = QdrantClient(

    host=settings.qdrant_host,

    port=settings.qdrant_port

)

def ensure_collection(vector_size: int):

    collections = [

        c.name

        for c in _client.get_collections().collections

    ]

    if settings.qdrant_collection not in collections:

        _client.create_collection(

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

    _client.upsert(

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

    return _client.search(

        collection_name=settings.qdrant_collection,

        query_vector=query_vector,

        limit=top_k,

        query_filter=query_filter

    )