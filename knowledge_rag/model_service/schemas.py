from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    embed_model: str
    embed_dim: int
    rerank_model: Optional[str] = None


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=128)


class EmbedResponse(BaseModel):
    model: str
    dim: int
    vectors: list[list[float]]


class RerankItem(BaseModel):
    doc_id: str
    text: str


class RerankRequest(BaseModel):
    query: str = Field(min_length=1, max_length=512)
    items: list[RerankItem] = Field(min_length=1, max_length=200)
    top_k: int = Field(default=20, ge=1, le=200)


class RerankResult(BaseModel):
    doc_id: str
    score: float


class RerankResponse(BaseModel):
    model: str
    results: list[RerankResult]


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=512)
    top_k: int = Field(default=10, ge=1, le=100)
    w: int | None = Field(default=None, ge=0, le=3, description="Neighbor window; defaults to settings.neighbor_window")


class SearchResult(BaseModel):
    doc_id: str | None = None
    source: str | None = None
    title: str | None = None
    section_title: str | None = None

    page_start: int | None = None
    page_end: int | None = None
    chunk_ids: list[str] = Field(default_factory=list)

    score: float | None = None
    content: str


class SearchResponse(BaseModel):
    query: str
    top_k: int
    w: int
    results: list[SearchResult]
