package com.graduation.knowledgeback.api.dto;

import java.util.List;

public record AdminRoleResponse(
        Long id,
        String code,
        String name,
        String description,
        boolean systemRole,
        List<String> permissions
) {
}
