package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SingleSearchRequest", description = "单路检索请求（不做融合）")
public record SingleSearchRequest(
        @Schema(description = "用户查询文本", example = "压铸 模具 热处理")
        @NotBlank String query,

        @Schema(description = "检索模式：keyword（ES）或 vector（Qdrant）", example = "keyword")
        @Pattern(regexp = "(?i)keyword|vector", message = "mode must be keyword or vector") String mode,

        @Schema(description = "返回结果条数（1~100）", example = "10")
        @Min(1) @Max(100) Integer topK
) {
    public SingleSearchRequest {
        if (topK == null) {
            topK = 10;
        }
    }
}
