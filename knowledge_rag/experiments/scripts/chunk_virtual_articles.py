"""只处理 data/raw/virtual_articles 的 DOCX 切片脚本。

输出：data/processed/virtual_articles.jsonl（每行一个 chunk）。

设计目标（适合检索/RAG）：
- 基于“句子聚合”切片，避免硬截断破坏语义。
- 维持一定 overlap，降低跨块信息断裂。
- 尽量提取章节/小节标题（如果文档里有“第x章/1.2/一、”等结构）。
- 输出字段与现有入库/检索保持一致：chunk_id/source/page_num/anchor_text/content 等。

运行示例：
  python experiments/scripts/01_chunk_virtual_articles.py \
    --input-dir data/raw/virtual_articles \
    --output data/processed/virtual_articles.jsonl \
    --chunk-size 800 \
    --overlap-sentences 2
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from dataclasses import dataclass

try:
    from docx import Document  # type: ignore[import-not-found]
except Exception:
    Document = None


@dataclass(frozen=True)
class ChunkConfig:
    chunk_size: int
    min_chunk_size: int
    overlap_sentences: int


def _repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def clean_text_basic(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    text = "".join([c for c in text if c.isprintable()])
    return text.strip()


def split_sentences(text: str) -> list[str]:
    """按 。！？ 及换行切句，保留分隔符。"""
    if not text:
        return []
    pattern = r"([。！？\n])"
    parts = re.split(pattern, text)
    sentences: list[str] = []
    current = ""
    for part in parts:
        current += part
        if re.match(pattern, part):
            s = current.strip()
            if s:
                sentences.append(s)
            current = ""
    if current.strip():
        sentences.append(current.strip())
    return sentences


_TITLE_PATTERNS = [
    r"^第[一二三四五六七八九十]+章\b",
    r"^第[一二三四五六七八九十]+节\b",
    r"^\d+(?:\.\d+){0,4}\s+",
    r"^[一二三四五六七八九十]+、",
    r"^[（(]?[一二三四五六七八九十]+[)）]",
]


def looks_like_title(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if len(s) > 40:
        return False
    return any(re.match(p, s) for p in _TITLE_PATTERNS)


def _iter_sentences_with_section_titles(paragraphs: list[str]) -> list[tuple[str, str]]:
    """把段落展开为 (sentence, section_title)。

    关键点：section_title 是“就近标题”，会随着文档内容推进而变化。
    """
    current_title = "virtual_articles"
    out: list[tuple[str, str]] = []
    for p in paragraphs:
        p_clean = clean_text_basic(p)
        if not p_clean:
            continue

        if looks_like_title(p_clean):
            current_title = p_clean
            # 保留标题行本身，方便 chunk 里携带结构信息
            out.append((p_clean + "\n", current_title))
            continue

        for sent in split_sentences(p_clean):
            if sent.strip():
                out.append((sent, current_title))

        # 段落之间加一个换行提示（不会影响检索，但能保留一点结构感）
        out.append(("\n", current_title))

    return [(s, t) for s, t in out if s]


def semantic_chunking(sentences: list[tuple[str, str]], cfg: ChunkConfig) -> list[tuple[str, str]]:
    """语义切片：输入为 (sentence, section_title)，输出为 (chunk_text, chunk_section_title)。"""
    chunks: list[tuple[str, str]] = []
    current: list[tuple[str, str]] = []
    current_len = 0

    def finalize(buf: list[tuple[str, str]]) -> None:
        text = "".join(s for s, _ in buf)
        if len(text) < cfg.min_chunk_size:
            return
        # 取 chunk 内“最后一个句子”的 title，近似等于最近标题
        chunk_title = buf[-1][1] if buf else "virtual_articles"
        chunks.append((text, chunk_title))

    for sent, title in sentences:
        sent_len = len(sent)
        if current_len + sent_len > cfg.chunk_size and current_len > 0:
            finalize(current)

            overlap = current[-cfg.overlap_sentences :] if cfg.overlap_sentences > 0 else []
            current = list(overlap)
            current_len = sum(len(s) for s, _ in overlap)

        current.append((sent, title))
        current_len += sent_len

    if current:
        finalize(current)

    return chunks


def iter_docx_chunks(file_path: str, rel_source: str, cfg: ChunkConfig) -> list[dict]:
    if Document is None:
        raise RuntimeError("Missing dependency python-docx. Install it: pip install python-docx")

    doc = Document(file_path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]

    sentences_with_titles = _iter_sentences_with_section_titles(paragraphs)
    doc_id = _md5(rel_source)

    chunks = semantic_chunking(sentences_with_titles, cfg)

    results: list[dict] = []
    for idx, (chunk_text, chunk_section_title) in enumerate(chunks, start=1):
        anchor_match = re.match(r"[^。！？]*[。！？]", chunk_text)
        anchor = anchor_match.group() if anchor_match else chunk_text[:30]

        results.append(
            {
                "doc_id": doc_id,
                "chunk_id": f"{doc_id}_va_{idx}",
                "title": os.path.basename(rel_source),
                "source": rel_source.replace("\\", "/"),
                "file_type": "docx",
                "page_num": idx,
                "section_title": chunk_section_title,
                "content": chunk_text,
                "anchor_text": anchor,
                "chunk_len": len(chunk_text),
            }
        )

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Chunk DOCX files under virtual_articles only")
    parser.add_argument(
        "--input-dir",
        default=os.path.join(_repo_root(), "data", "raw", "virtual_articles"),
        help="Directory containing DOCX virtual articles (default: data/raw/virtual_articles)",
    )
    parser.add_argument(
        "--output",
        default=os.path.join(_repo_root(), "data", "processed", "virtual_articles.jsonl"),
        help="Output JSONL path (default: data/processed/virtual_articles.jsonl)",
    )
    parser.add_argument("--chunk-size", type=int, default=800, help="Target chunk size (chars)")
    parser.add_argument("--min-chunk-size", type=int, default=80, help="Drop chunks shorter than this")
    parser.add_argument("--overlap-sentences", type=int, default=2, help="Sentence overlap between chunks")

    args = parser.parse_args()

    input_dir = os.path.abspath(args.input_dir)
    output_path = os.path.abspath(args.output)

    if not os.path.isdir(input_dir):
        raise SystemExit(f"Input dir not found: {input_dir}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    cfg = ChunkConfig(
        chunk_size=args.chunk_size,
        min_chunk_size=args.min_chunk_size,
        overlap_sentences=args.overlap_sentences,
    )

    all_chunks: list[dict] = []
    for name in os.listdir(input_dir):
        if name.startswith("."):
            continue
        if not name.lower().endswith(".docx"):
            continue

        file_path = os.path.join(input_dir, name)
        rel_source = os.path.relpath(file_path, os.path.join(_repo_root(), "data", "raw"))

        all_chunks.extend(iter_docx_chunks(file_path=file_path, rel_source=rel_source, cfg=cfg))

    with open(output_path, "w", encoding="utf-8") as handle:
        for obj in all_chunks:
            handle.write(json.dumps(obj, ensure_ascii=False) + "\n")

    print(f"✅ virtual_articles 切片完成：{len(all_chunks)} chunks -> {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
