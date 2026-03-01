package com.graduation.knowledgeback.api.dto;

import com.graduation.knowledgeback.domain.DocumentStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(name = "DocumentItem", description = "文档列表条目")
public record DocumentItem(
        @Schema(description = "逻辑文档 ID（payload.doc_id）")
        String docId,
        @Schema(description = "原始文件名")
        String originalFilename,
        @Schema(description = "存储路径/来源")
        String storedPath,
        @Schema(description = "文档状态")
        DocumentStatus status,
        @Schema(description = "创建时间")
        Instant createdAt,
        @Schema(description = "错误信息（如果有）")
        String errorMessage
) {
}
