package com.graduation.knowledgeback.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;

@Schema(name = "QaResponse", description = "问答响应")
public record QaResponse(
        @Schema(description = "检索 ID")
        String searchId,
        @Schema(description = "问题")
        String query,
        @Schema(description = "生成的答案")
        String answer,
        @Schema(description = "耗时统计")
        Map<String, Long> timingMs,
        @Schema(description = "证据来源")
        List<SearchResultItem> sources
) {
}
