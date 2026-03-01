package com.graduation.knowledgeback.api.dto;

import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SingleSearchResponse", description = "单路检索响应")
public record SingleSearchResponse(
        @Schema(description = "本次检索的唯一 ID", example = "b0a7c4f5fdfb44d8a1b7d8c1d2a3e4f5")
        String searchId,
        String query,
        @Schema(description = "检索模式：keyword 或 vector")
        String mode,
        @Schema(description = "总耗时（毫秒）")
        long totalTimeMs,
        List<SearchResultItem> results
) {
}
