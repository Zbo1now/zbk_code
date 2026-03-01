package com.graduation.knowledgeback.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UploadResponse", description = "异步任务响应（upload/delete/rebuild 统一返回）")
public record UploadResponse(
        @Schema(description = "任务 ID，用于查询任务状态")
        String taskId,
        @Schema(description = "文档 ID（如果是批量导入则可能为 null）")
        String docId,
        @Schema(description = "状态（processing/success/failed 等）")
        String status,
        @Schema(description = "提示信息")
        String message
) {
}
