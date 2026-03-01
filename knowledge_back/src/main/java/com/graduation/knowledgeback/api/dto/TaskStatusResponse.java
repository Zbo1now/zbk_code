package com.graduation.knowledgeback.api.dto;

import com.graduation.knowledgeback.domain.TaskStatus;
import com.graduation.knowledgeback.domain.TaskType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(name = "TaskStatusResponse", description = "异步任务状态")
public record TaskStatusResponse(
        @Schema(description = "任务 ID")
        String taskId,
        @Schema(description = "任务类型")
        TaskType type,
        @Schema(description = "任务状态")
        TaskStatus status,
        @Schema(description = "进度（0~100）")
        Integer progress,
        @Schema(description = "错误信息（失败时）")
        String errorMessage,
        @Schema(description = "创建时间")
        Instant createdAt,
        @Schema(description = "开始时间")
        Instant startedAt,
        @Schema(description = "结束时间")
        Instant finishedAt
) {
}
