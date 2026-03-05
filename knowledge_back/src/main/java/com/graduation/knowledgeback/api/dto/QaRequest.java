package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "QaRequest", description = "问答请求（检索 + LLM 生成）")
public record QaRequest(
        @Schema(description = "用户问题")
        @NotBlank String query,
        @Schema(description = "返回结果条数（1~20）")
        @Min(1) @Max(20) Integer topK,
        @Schema(description = "是否开启 rerank 精排")
        Boolean useRerank
) {
    public QaRequest {
        if (topK == null) {
            topK = 6;
        }
    }
}
