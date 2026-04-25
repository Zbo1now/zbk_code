import torch
from typing import List
from ..schemas import Document
from ..settings import get_settings
import logging

logger = logging.getLogger(__name__)

_rerank_service = None


class RerankService:
    def __init__(self):
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._load_model()

    def _load_model(self):
        """加载 Cross-Encoder 模型"""
        settings = get_settings()
        try:
            from sentence_transformers import CrossEncoder
            logger.info(f"正在从 {settings.RERANKER_MODEL_PATH} 加载 Reranker 模型...")
            self.model = CrossEncoder(
                settings.RERANKER_MODEL_NAME,
                max_length=512,
                device=self.device,
                cache_folder=settings.RERANKER_MODEL_PATH
            )
            logger.info(f"Reranker 模型加载成功，运行在 {self.device}。")
        except Exception as e:
            logger.warning(f"加载 Reranker 模型失败（服务仍可正常运行）: {e}")
            self.model = None

    def rerank(self, query: str, documents: List[Document], top_n: int = 10) -> List[Document]:
        if not self.model:
            logger.warning("Reranker 模型未加载，将返回原始文档顺序。")
            return documents[:top_n]

        if not documents:
            return []

        sentence_pairs = [(query, doc.page_content) for doc in documents]
        scores = self.model.predict(sentence_pairs, convert_to_numpy=True)

        for doc, score in zip(documents, scores):
            doc.score = float(score)

        sorted_docs = sorted(documents, key=lambda x: x.score, reverse=True)
        return sorted_docs[:top_n]


def _get_rerank_service() -> RerankService:
    global _rerank_service
    if _rerank_service is None:
        _rerank_service = RerankService()
    return _rerank_service


def rerank_documents(query: str, documents: List[Document], top_n: int = 10) -> List[Document]:
    return _get_rerank_service().rerank(query, documents, top_n)
