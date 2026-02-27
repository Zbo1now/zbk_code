from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    service_name: str = Field(default="knowledge_rag_model_service")

    embed_model: str = Field(default="BAAI/bge-base-zh-v1.5")
    embed_dim: int = Field(default=768)

    normalize_embeddings: bool = Field(default=True)

    # optional reranker
    rerank_model: str | None = Field(default=None)

    # retrieval (Qdrant)
    qdrant_url: str = Field(default="http://localhost:6333")
    qdrant_collection: str = Field(default="knowledge_chunks")

    # post-processing
    neighbor_window: int = Field(default=1, ge=0, le=3)


@lru_cache
def get_settings() -> Settings:
    return Settings()
