package com.graduation.knowledgeback.api.dto;

import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PagedResponse", description = "通用分页响应")
public record PagedResponse<T>(
        @Schema(description = "当前页（从 1 开始）")
        int page,
        @Schema(description = "每页条数")
        int pageSize,
        @Schema(description = "总条数")
        long total,
        @Schema(description = "数据列表")
        List<T> items
) {
}
