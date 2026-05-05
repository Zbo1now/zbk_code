package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AdminGrantCreateRequest(
        @NotNull(message = "用户 ID 不能为空")
        Long userId,
        @NotBlank(message = "权限编码不能为空")
        String permissionCode,
        @NotBlank(message = "资源类型不能为空")
        String resourceType,
        String resourceId,
        String effectiveTo
) {
}
