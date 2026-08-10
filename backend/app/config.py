from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    qdrant_host: str = "qdrant-service.rag-app.svc.cluster.local"

    qdrant_port: int = 6333

    qdrant_collection: str = "documents"


    ollama_host: str = "http://ollama-service.rag-app.svc.cluster.local:11434"

    llm_model: str = "llama3.2:3b"

    embedding_model: str = "nomic-embed-text"


    chunk_size: int = 500

    chunk_overlap: int = 50

    top_k: int = 4


    max_upload_mb: int = 25


    class Config:

        env_file = ".env"


settings = Settings()