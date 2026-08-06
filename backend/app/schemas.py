from pydantic import BaseModel
from typing import List


class UploadResponse(BaseModel):

    document_id: str

    filename: str

    chunks_indexed: int


class AskRequest(BaseModel):

    question: str

    document_id: str | None = None


class AskResponse(BaseModel):

    answer: str

    sources: List[str]