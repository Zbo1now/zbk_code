package com.graduation.knowledgeback.api.dto;

import java.util.List;

public record AdminUserResponse(
        Long userId,
        String username,
        String displayName,
        String email,
        String department,
        boolean enabled,
        List<String> roles,
        List<String> permissions
) {
}
