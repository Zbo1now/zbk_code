package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.NotBlank;

public record AdminUserRoleUpdateRequest(
        @NotBlank(message = "角色编码不能为空")
        String roleCode
) {
}
