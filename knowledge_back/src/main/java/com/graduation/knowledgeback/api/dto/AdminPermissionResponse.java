package com.graduation.knowledgeback.api.dto;

public record AdminPermissionResponse(
        Long id,
        String code,
        String name,
        String module,
        String description
) {
}
