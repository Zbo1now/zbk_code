package com.graduation.knowledgeback.api.dto;

import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SearchResultItem", description = "检索结果条目")
public record SearchResultItem(
        @Schema(description = "排序名次（从 1 开始）")
        int rank,
        @Schema(description = "综合得分（融合/精排后的分数）")
        double score,
        @Schema(description = "命中文本内容（chunk 内容）")
        String content,
        @Schema(description = "来源（例如文件路径、URL、source 字段等）")
        String source,
        @Schema(description = "起始页码（如果有）")
        Integer pageStart,
        @Schema(description = "结束页码（如果有）")
        Integer pageEnd,
        @Schema(description = "逻辑文档 ID（对齐 payload.doc_id）")
        String docId,
        @Schema(description = "命中 chunkId 列表（预留对齐 RAG 合并结果）")
        List<String> chunkIds,
        @Schema(description = "检索来源/融合方式标记（如 es/qdrant/rrf/rerank）")
        String retrievalSource
) {
}
