from __future__ import annotations

from functools import lru_cache
from typing import Any

from fastapi import APIRouter, HTTPException
from sentence_transformers import SentenceTransformer

try:
    from qdrant_client import QdrantClient  # type: ignore
    from qdrant_client.http import models as qmodels  # type: ignore
except Exception:  # pragma: no cover
    QdrantClient = None  # type: ignore
    qmodels = None  # type: ignore

from model_service.schemas import (
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    SearchRequest,
    SearchResponse,
    SearchResult,
    RerankRequest,
    RerankResponse,
    RerankResult,
)
from model_service.settings import get_settings

router = APIRouter()


@lru_cache
def _get_embedder() -> SentenceTransformer:
    settings = get_settings()
    return SentenceTransformer(settings.embed_model)


@lru_cache
def _get_qdrant() -> Any:
    settings = get_settings()
    if QdrantClient is None:
        raise RuntimeError("Missing dependency qdrant-client")
    return QdrantClient(url=settings.qdrant_url)


def _as_float_list(vec: Any) -> list[float]:
    if hasattr(vec, "tolist"):
        return [float(x) for x in vec.tolist()]
    return [float(x) for x in vec]


def _extract_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _merge_texts_with_overlap(texts: list[str], max_overlap: int = 300) -> str:
    if not texts:
        return ""
    merged = texts[0]
    for nxt in texts[1:]:
        if not nxt:
            continue
        kmax = min(len(merged), len(nxt), max_overlap)
        overlap = 0
        for k in range(kmax, 0, -1):
            if merged.endswith(nxt[:k]):
                overlap = k
                break
        merged += nxt[overlap:]
    return merged


def _qdrant_points(result: Any) -> list[Any]:
    if result is None:
        return []
    points = getattr(result, "points", None)
    if points is not None:
        return list(points)
    points = getattr(result, "result", None)
    if points is not None:
        return list(points)
    return []


def _scroll_neighbors(
    client: Any,
    collection: str,
    *,
    doc_id: str,
    source: str | None,
    page_center: int,
    w: int,
) -> list[dict[str, Any]]:
    if qmodels is None:
        return []

    must: list[Any] = [qmodels.FieldCondition(key="doc_id", match=qmodels.MatchValue(value=doc_id))]
    if source:
        must.append(qmodels.FieldCondition(key="source", match=qmodels.MatchValue(value=source)))

    must.append(
        qmodels.FieldCondition(
            key="page_num",
            range=qmodels.Range(gte=page_center - w, lte=page_center + w),
        )
    )

    filt = qmodels.Filter(must=must)
    points, _ = client.scroll(
        collection_name=collection,
        scroll_filter=filt,
        with_payload=True,
        with_vectors=False,
        limit=max(2 * w + 1, 1),
    )

    out: list[dict[str, Any]] = []
    for p in points or []:
        payload = getattr(p, "payload", None) or {}
        if isinstance(payload, dict):
            out.append(payload)
    return out


def _neighbor_expand_and_merge(
    *,
    client: Any,
    collection: str,
    base_hits: list[Any],
    w: int,
    top_k: int,
) -> list[SearchResult]:
    # 1) Collect center hits
    by_doc: dict[tuple[str, str | None], dict[int, dict[str, Any]]] = {}
    scores: dict[tuple[str, str | None, int], float] = {}
    raw_fallback: list[SearchResult] = []

    for hit in base_hits:
        payload = getattr(hit, "payload", None) or {}
        if not isinstance(payload, dict):
            payload = {}

        doc_id = payload.get("doc_id")
        source = payload.get("source")
        page_num = _extract_int(payload.get("page_num"))
        content = payload.get("content") or ""
        chunk_id = payload.get("chunk_id")
        score = getattr(hit, "score", None)

        if not isinstance(doc_id, str) or page_num is None:
            raw_fallback.append(
                SearchResult(
                    doc_id=doc_id if isinstance(doc_id, str) else None,
                    source=source if isinstance(source, str) else None,
                    title=payload.get("title") if isinstance(payload.get("title"), str) else None,
                    section_title=payload.get("section_title")
                    if isinstance(payload.get("section_title"), str)
                    else None,
                    page_start=page_num,
                    page_end=page_num,
                    chunk_ids=[chunk_id] if isinstance(chunk_id, str) else [],
                    score=float(score) if isinstance(score, (int, float)) else None,
                    content=str(content),
                )
            )
            continue

        key = (doc_id, source if isinstance(source, str) else None)
        by_doc.setdefault(key, {})[page_num] = payload

        if isinstance(score, (int, float)):
            scores[(doc_id, key[1], page_num)] = float(score)

    # 2) Neighbor expansion
    if w > 0:
        for (doc_id, source), pages in list(by_doc.items()):
            for page_center in list(pages.keys()):
                for payload in _scroll_neighbors(
                    client,
                    collection,
                    doc_id=doc_id,
                    source=source,
                    page_center=page_center,
                    w=w,
                ):
                    pn = _extract_int(payload.get("page_num"))
                    if pn is None:
                        continue
                    pages.setdefault(pn, payload)

    # 3) Merge consecutive chunks per doc
    merged_results: list[SearchResult] = []
    for (doc_id, source), pages in by_doc.items():
        page_nums = sorted(pages.keys())
        if not page_nums:
            continue

        run: list[int] = [page_nums[0]]
        for pn in page_nums[1:]:
            if pn == run[-1] + 1:
                run.append(pn)
            else:
                merged_results.append(_build_merged(doc_id, source, run, pages, scores))
                run = [pn]
        merged_results.append(_build_merged(doc_id, source, run, pages, scores))

    # 4) Rank and cut
    merged_results.sort(key=lambda r: (r.score is not None, r.score or float("-inf")), reverse=True)
    final = (merged_results + raw_fallback)[:top_k]
    return final


def _build_merged(
    doc_id: str,
    source: str | None,
    run_pages: list[int],
    pages: dict[int, dict[str, Any]],
    scores: dict[tuple[str, str | None, int], float],
) -> SearchResult:
    payload0 = pages[run_pages[0]]
    title = payload0.get("title") if isinstance(payload0.get("title"), str) else None

    best_page = run_pages[0]
    best_score = float("-inf")
    for pn in run_pages:
        s = scores.get((doc_id, source, pn))
        if s is not None and s > best_score:
            best_score = s
            best_page = pn

    payload_best = pages.get(best_page, payload0)
    section_title = (
        payload_best.get("section_title")
        if isinstance(payload_best.get("section_title"), str)
        else None
    )

    chunk_ids: list[str] = []
    texts: list[str] = []
    score_vals: list[float] = []

    for pn in run_pages:
        pld = pages[pn]
        cid = pld.get("chunk_id")
        if isinstance(cid, str):
            chunk_ids.append(cid)
        texts.append(str(pld.get("content") or ""))
        s = scores.get((doc_id, source, pn))
        if s is not None:
            score_vals.append(s)

    merged_text = _merge_texts_with_overlap(texts)
    merged_score = max(score_vals) if score_vals else None

    return SearchResult(
        doc_id=doc_id,
        source=source,
        title=title,
        section_title=section_title,
        page_start=run_pages[0],
        page_end=run_pages[-1],
        chunk_ids=chunk_ids,
        score=merged_score,
        content=merged_text,
    )


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        embed_model=settings.embed_model,
        embed_dim=settings.embed_dim,
        rerank_model=settings.rerank_model,
    )


@router.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    settings = get_settings()
    model = _get_embedder()

    vectors = model.encode(req.texts, normalize_embeddings=settings.normalize_embeddings)

    if hasattr(vectors, "tolist"):
        vectors_list = vectors.tolist()
    else:
        vectors_list = [list(v) for v in vectors]

    if vectors_list:
        dim = len(vectors_list[0])
        if dim != settings.embed_dim:
            raise HTTPException(
                status_code=500,
                detail=f"Embedding dim mismatch: got {dim}, expected {settings.embed_dim}. Check EMBED_MODEL/EMBED_DIM.",
            )
    else:
        dim = settings.embed_dim

    return EmbedResponse(model=settings.embed_model, dim=dim, vectors=vectors_list)


@router.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest) -> RerankResponse:
    settings = get_settings()
    if not settings.rerank_model:
        raise HTTPException(
            status_code=501,
            detail="Reranker not configured. Set RERANK_MODEL to enable /rerank.",
        )

    # 说明：这里先给一个最小可用的占位实现（不加载 cross-encoder），
    # 后续你确定 reranker 模型后我再接入 CrossEncoder 做真实打分。
    results = [RerankResult(doc_id=item.doc_id, score=0.0) for item in req.items[: req.top_k]]
    return RerankResponse(model=settings.rerank_model, results=results)


@router.post("/search", response_model=SearchResponse)
def search(req: SearchRequest) -> SearchResponse:
    settings = get_settings()

    if QdrantClient is None or qmodels is None:
        raise HTTPException(status_code=500, detail="Missing dependency qdrant-client")

    qdrant = _get_qdrant()
    model = _get_embedder()

    query_vec = model.encode(req.query, normalize_embeddings=settings.normalize_embeddings)
    query_vec_list = _as_float_list(query_vec)
    if len(query_vec_list) != settings.embed_dim:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding dim mismatch: got {len(query_vec_list)}, expected {settings.embed_dim}. Check EMBED_MODEL/EMBED_DIM.",
        )

    try:
        result = qdrant.query_points(
            collection_name=settings.qdrant_collection,
            query=query_vec_list,
            limit=req.top_k,
            with_payload=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Qdrant query failed: {exc}") from exc

    hits = _qdrant_points(result)
    w = settings.neighbor_window if req.w is None else req.w
    merged = _neighbor_expand_and_merge(
        client=qdrant,
        collection=settings.qdrant_collection,
        base_hits=hits,
        w=w,
        top_k=req.top_k,
    )

    return SearchResponse(query=req.query, top_k=req.top_k, w=w, results=merged)
