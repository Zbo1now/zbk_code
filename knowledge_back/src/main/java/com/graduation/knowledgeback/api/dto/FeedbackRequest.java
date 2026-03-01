package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.NotBlank;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "FeedbackRequest", description = "相关性反馈请求")
public record FeedbackRequest(
        @Schema(description = "检索 ID（来自 search 接口返回的 searchId）")
        @NotBlank String searchId,

        @Schema(description = "逻辑文档 ID（payload.doc_id）")
        String docId,

        @Schema(description = "chunkId（payload.chunk_id；如果结果合并，可选择第一个 chunkId 回传）")
        String chunkId,

        @Schema(description = "该结果在返回列表中的 rank（从 1 开始）")
        Integer rank,

        @Schema(description = "是否相关", example = "true")
        boolean isRelevant
) {
}
