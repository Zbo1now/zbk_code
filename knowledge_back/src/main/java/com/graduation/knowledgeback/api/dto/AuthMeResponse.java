package com.graduation.knowledgeback.api.dto;

import java.util.List;

public record AuthMeResponse(
        Long userId,
        String username,
        String displayName,
        boolean enabled,
        List<String> roles,
        List<String> permissions
) {
}
