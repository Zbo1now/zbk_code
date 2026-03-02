package com.graduation.knowledgeback.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SystemStatusResponse", description = "系统依赖状态响应")
public record SystemStatusResponse(
        @Schema(description = "Elasticsearch 集群状态（green/yellow/red/down/unknown）")
        String elasticsearch,
        @Schema(description = "Elasticsearch 索引数量（无法获取则为 null）")
        Integer indexCount,
        @Schema(description = "Elasticsearch 节点数量（无法获取则为 null）")
        Integer nodeCount,
        @Schema(description = "Elasticsearch 健康检查响应耗时（毫秒，无法获取则为 null）")
        Long latencyMs,
        @Schema(description = "Qdrant collection 点数量（无法获取则为 null）")
        Long qdrantCount,
        @Schema(description = "模型服务 rerank 模型标识（down/not_configured/unknown 或具体模型名）")
        String rerankerModel
) {
}
