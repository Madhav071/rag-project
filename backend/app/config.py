from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    qdrant_host: str = "localhost"

    qdrant_port: int = 6333

    qdrant_collection: str = "documents"


    ollama_host: str = "http://localhost:11434"

    llm_model: str = "gemma2:2b"

    embedding_model: str = "nomic-embed-text"


    chunk_size: int = 500

    chunk_overlap: int = 50

    top_k: int = 4


    max_upload_mb: int = 25


    class Config:

        env_file = ".env"


settings = Settings()