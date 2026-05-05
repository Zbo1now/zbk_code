package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserPermissionRequestCreateRequest(
        @NotBlank(message = "permissionCode is required")
        String permissionCode,
        @NotBlank(message = "resourceType is required")
        String resourceType,
        String resourceId,
        @Size(max = 500, message = "reason must be <= 500 characters")
        String reason
) {
}
