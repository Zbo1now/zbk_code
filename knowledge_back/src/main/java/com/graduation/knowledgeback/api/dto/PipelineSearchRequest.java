package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Map;

@Schema(name = "PipelineSearchRequest", description = "Pipeline 检索请求：混合召回 + 融合 + 可选 rerank")
public record PipelineSearchRequest(
        @Schema(description = "用户查询文本", example = "压铸 模具 热处理")
        @NotBlank String query,

        @Schema(description = "返回结果条数（1~100）", example = "5")
        @Min(1) @Max(100) Integer topK,

        @Schema(description = "是否开启 rerank 精排（true 会调用模型服务 /rerank）", example = "true")
        Boolean useRerank,

        @Schema(description = "过滤条件（key 使用 camelCase，后端会映射/转为索引字段 snake_case）", example = "{\"docType\":\"txt\"}")
        Map<String, String> filters
) {
    public PipelineSearchRequest {
        if (topK == null) {
            topK = 5;
        }
    }
}
