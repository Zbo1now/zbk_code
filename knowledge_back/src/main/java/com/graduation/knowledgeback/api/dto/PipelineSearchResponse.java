package com.graduation.knowledgeback.api.dto;

import java.util.List;
import java.util.Map;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PipelineSearchResponse", description = "Pipeline 检索响应")
public record PipelineSearchResponse(
        @Schema(description = "本次检索的唯一 ID，用于反馈/追踪", example = "b0a7c4f5fdfb44d8a1b7d8c1d2a3e4f5")
        String searchId,
        @Schema(description = "原始查询文本")
        String query,
        @Schema(description = "总耗时（毫秒）")
        long totalTimeMs,
        @Schema(description = "分阶段耗时（毫秒），如 esMs/qdrantMs/fusionMs/rerankMs")
        Map<String, Long> timingMs,
        @Schema(description = "结果列表")
        List<SearchResultItem> results
) {
}
