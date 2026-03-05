package com.graduation.knowledgeback.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "DocumentPreviewResponse", description = "文档预览内容")
public record DocumentPreviewResponse(
        @Schema(description = "文档 ID")
        String docId,
        @Schema(description = "原始文件名")
        String originalFilename,
        @Schema(description = "展示名称")
        String displayName,
        @Schema(description = "备注信息")
        String description,
        @Schema(description = "文件类型")
        String fileType,
        @Schema(description = "文档状态")
        String status,
        @Schema(description = "文件大小 (字节)")
        Long fileSize,
        @Schema(description = "创建时间")
        java.time.Instant createdAt,
        @Schema(description = "是否隐藏")
        Boolean hidden,
        @Schema(description = "文件校验和")
        String checksum,
        @Schema(description = "预览内容（纯文本）")
        String content,
        @Schema(description = "错误信息（若解析失败）")
        String errorMessage
) {
}
