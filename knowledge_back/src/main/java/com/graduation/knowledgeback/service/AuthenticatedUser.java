package com.graduation.knowledgeback.service;

import java.util.Set;

public record AuthenticatedUser(
        Long userId,
        String username,
        String displayName,
        boolean enabled,
        Set<String> roleCodes,
        Set<String> permissions
) {
    public boolean isAdmin() {
        return roleCodes != null && roleCodes.contains("ADMIN");
    }
}
