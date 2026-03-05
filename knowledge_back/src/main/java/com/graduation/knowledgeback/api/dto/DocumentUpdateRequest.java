package com.graduation.knowledgeback.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "DocumentUpdateRequest", description = "文档信息更新请求")
public record DocumentUpdateRequest(
        @Schema(description = "展示名称")
        String displayName,
        @Schema(description = "备注信息")
        String description,
        @Schema(description = "是否隐藏")
        Boolean hidden
) {
}
