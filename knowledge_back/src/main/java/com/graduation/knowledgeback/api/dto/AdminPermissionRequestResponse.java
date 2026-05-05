package com.graduation.knowledgeback.api.dto;

import java.time.Instant;

public record AdminPermissionRequestResponse(
        Long id,
        Long userId,
        String permissionCode,
        String resourceType,
        String resourceId,
        String reason,
        String status,
        Long reviewerId,
        String reviewComment,
        Instant createdAt,
        Instant reviewedAt
) {
}
