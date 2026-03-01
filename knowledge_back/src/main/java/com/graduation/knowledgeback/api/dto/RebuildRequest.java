package com.graduation.knowledgeback.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "RebuildRequest", description = "重建索引请求")
public record RebuildRequest(
        @Schema(description = "是否重建 Elasticsearch（默认 true）")
        Boolean rebuildEs,
        @Schema(description = "是否重建 Qdrant（默认 true）")
        Boolean rebuildQdrant,
        @Schema(description = "是否重新生成向量（当前实现暂未严格区分）")
        Boolean reEmbed
) {
}
