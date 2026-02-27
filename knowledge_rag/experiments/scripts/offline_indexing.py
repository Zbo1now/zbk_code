"""离线入库脚本：将切片文本写入 Qdrant（可选同步写 ES）。

典型用法（只写 Qdrant）：
  python experiments/scripts/offline_indexing.py \
    --input data/processed/knowledge.jsonl \
    --qdrant-url http://localhost:6333 \
    --collection knowledge_chunks \
        --model BAAI/bge-base-zh-v1.5

可选：同时写入 Elasticsearch（用于关键词检索）：
  python experiments/scripts/offline_indexing.py \
    --input data/processed/knowledge.jsonl \
    --with-es --es-url http://localhost:9200 --es-index knowledge_chunks

说明：
- 如果 JSONL 内已包含向量字段（默认名 embedding），可以加 --vector-field embedding 跳过模型编码。
- 当前项目 docker-compose 的 ES 安全关闭（http），脚本默认直接连。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from dataclasses import dataclass
from typing import Any, Iterable

try:
    from loguru import logger  # type: ignore
except Exception:  # pragma: no cover
    import logging

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    class _CompatLogger:
        def info(self, msg: str) -> None:
            logging.info(msg)

        def warning(self, msg: str) -> None:
            logging.warning(msg)

        def error(self, msg: str) -> None:
            logging.error(msg)

        def success(self, msg: str) -> None:
            logging.info(msg)

    logger = _CompatLogger()  # type: ignore

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
except ModuleNotFoundError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: qdrant-client. "
        "Install it with: pip install -r requirements.txt"
    ) from exc


@dataclass(frozen=True)
class Record:
    chunk_id: str
    content: str
    payload: dict[str, Any]
    vector: list[float] | None


def _repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _iter_jsonl(path: str) -> Iterable[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON at {path}:{line_no}: {exc}") from exc


def _stable_id(chunk_id: str) -> str:
    """给 Qdrant 的 point id。

    说明：部分 Qdrant 版本只允许 unsigned int 或 UUID。
    这里用 uuid5 从 chunk_id 生成稳定 UUID，保证可重复入库/覆盖。
    """
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


def _default_payload(obj: dict[str, Any]) -> dict[str, Any]:
    # 尽量保留对检索展示有用的字段；content 也放入 payload 便于返回展示
    payload = dict(obj)
    return payload


def _load_records(
    input_path: str,
    vector_field: str | None,
    limit: int | None,
) -> list[Record]:
    records: list[Record] = []
    for obj in _iter_jsonl(input_path):
        chunk_id = obj.get("chunk_id")
        content = obj.get("content")
        if not chunk_id or not isinstance(chunk_id, str):
            raise ValueError("Each record must have a string field: chunk_id")
        if not content or not isinstance(content, str):
            raise ValueError("Each record must have a string field: content")

        vector: list[float] | None = None
        if vector_field:
            maybe_vec = obj.get(vector_field)
            if maybe_vec is None:
                raise ValueError(
                    f"--vector-field={vector_field} provided but record lacks that field: {chunk_id}"
                )
            if not isinstance(maybe_vec, list) or (maybe_vec and not isinstance(maybe_vec[0], (int, float))):
                raise ValueError(
                    f"Vector field {vector_field} must be a list[float], got {type(maybe_vec)} for {chunk_id}"
                )
            vector = [float(x) for x in maybe_vec]

        payload = _default_payload(obj)
        records.append(Record(chunk_id=chunk_id, content=content, payload=payload, vector=vector))
        if limit is not None and len(records) >= limit:
            break
    return records


def _encode_vectors(
    texts: list[str],
    model_name_or_path: str,
    batch_size: int,
) -> list[list[float]]:
    # 延迟导入，避免用户只用 --vector-field 时也拉起 torch
    from sentence_transformers import SentenceTransformer

    logger.info(f"Loading embedding model: {model_name_or_path}")
    model = SentenceTransformer(model_name_or_path)
    vectors = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
    )
    return [v.tolist() for v in vectors]


def _ensure_qdrant_collection(
    client: QdrantClient,
    collection: str,
    vector_size: int,
    distance: str,
    recreate: bool,
) -> None:
    if recreate:
        if client.collection_exists(collection):
            logger.warning(f"Recreating Qdrant collection: {collection}")
            client.delete_collection(collection)

    if client.collection_exists(collection):
        logger.info(f"Qdrant collection exists: {collection}")
        return

    dist = {
        "cosine": qmodels.Distance.COSINE,
        "dot": qmodels.Distance.DOT,
        "euclid": qmodels.Distance.EUCLID,
    }.get(distance.lower())
    if dist is None:
        raise ValueError("--distance must be one of: cosine, dot, euclid")

    logger.info(f"Creating Qdrant collection: {collection} (size={vector_size}, distance={distance})")
    client.create_collection(
        collection_name=collection,
        vectors_config=qmodels.VectorParams(size=vector_size, distance=dist),
    )


def _upsert_qdrant(
    client: QdrantClient,
    collection: str,
    records: list[Record],
    vectors: list[list[float]],
    batch_size: int,
) -> None:
    if len(records) != len(vectors):
        raise ValueError("records and vectors length mismatch")

    total = len(records)
    logger.info(f"Upserting {total} points into Qdrant collection: {collection}")
    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        points: list[qmodels.PointStruct] = []
        for rec, vec in zip(records[start:end], vectors[start:end], strict=True):
            points.append(
                qmodels.PointStruct(
                    id=_stable_id(rec.chunk_id),
                    vector=vec,
                    payload=rec.payload,
                )
            )
        client.upsert(collection_name=collection, points=points)


def _ensure_es_index(es, index_name: str) -> None:
    if es.indices.exists(index=index_name):
        return
    # 简化映射：中文分词/同义词等建议后续在 ES 侧配置 analyzer
    mapping = {
        "mappings": {
            "properties": {
                "chunk_id": {"type": "keyword"},
                "doc_id": {"type": "keyword"},
                "source": {"type": "keyword"},
                "file_type": {"type": "keyword"},
                "page_num": {"type": "integer"},
                "title": {"type": "text"},
                "section_title": {"type": "text"},
                "anchor_text": {"type": "text"},
                "content": {"type": "text"},
            }
        }
    }
    es.indices.create(index=index_name, **mapping)


def _bulk_index_es(es, index_name: str, records: list[Record]) -> None:
    # 使用 ES helpers bulk
    from elasticsearch import helpers

    actions = []
    for rec in records:
        actions.append(
            {
                "_op_type": "index",
                "_index": index_name,
                "_id": rec.chunk_id,
                "_source": rec.payload,
            }
        )

    helpers.bulk(es, actions, request_timeout=120)


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline indexing to Qdrant (optional Elasticsearch)")
    parser.add_argument(
        "--input",
        default=os.path.join(_repo_root(), "data", "processed", "knowledge.jsonl"),
        help="Path to JSONL file (default: data/processed/knowledge.jsonl)",
    )
    parser.add_argument("--qdrant-url", default="http://localhost:6333")
    parser.add_argument("--collection", default="knowledge_chunks")
    parser.add_argument(
        "--distance",
        default="cosine",
        help="Vector distance: cosine|dot|euclid (default: cosine)",
    )
    parser.add_argument(
        "--vector-field",
        default=None,
        help="If provided, read vectors from this JSON field (skip embedding model)",
    )
    parser.add_argument(
        "--model",
        default="BAAI/bge-base-zh-v1.5",
        help="SentenceTransformer model name/path (used when --vector-field not set)",
    )
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--recreate", action="store_true", help="Drop and recreate Qdrant collection")

    parser.add_argument("--with-es", action="store_true", help="Also index to Elasticsearch")
    parser.add_argument("--es-url", default="http://localhost:9200")
    parser.add_argument("--es-index", default="knowledge_chunks")

    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    if not os.path.exists(input_path):
        logger.error(f"Input file not found: {input_path}")
        return 2

    logger.info(f"Loading records from: {input_path}")
    records = _load_records(input_path, vector_field=args.vector_field, limit=args.limit)
    if not records:
        logger.warning("No records found, nothing to index")
        return 0

    if args.vector_field:
        vectors = [r.vector for r in records]
        if any(v is None for v in vectors):
            raise RuntimeError("Internal error: vector_field set but missing vector")
        typed_vectors: list[list[float]] = [v for v in vectors if v is not None]
    else:
        texts = [r.content for r in records]
        typed_vectors = _encode_vectors(texts, model_name_or_path=args.model, batch_size=args.batch_size)

    vector_size = len(typed_vectors[0])
    if any(len(v) != vector_size for v in typed_vectors):
        raise ValueError("Inconsistent vector dimensions")

    qdrant = QdrantClient(url=args.qdrant_url)
    _ensure_qdrant_collection(
        qdrant,
        collection=args.collection,
        vector_size=vector_size,
        distance=args.distance,
        recreate=args.recreate,
    )
    _upsert_qdrant(
        qdrant,
        collection=args.collection,
        records=records,
        vectors=typed_vectors,
        batch_size=args.batch_size,
    )
    logger.success(f"Qdrant indexing done: collection={args.collection}, points={len(records)}")

    if args.with_es:
        from elasticsearch import Elasticsearch

        es = Elasticsearch(args.es_url)
        _ensure_es_index(es, index_name=args.es_index)
        _bulk_index_es(es, index_name=args.es_index, records=records)
        logger.success(f"Elasticsearch indexing done: index={args.es_index}, docs={len(records)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
