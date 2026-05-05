package com.graduation.knowledgeback.api.dto;

import java.time.Instant;

public record AdminPermissionGrantResponse(
        Long id,
        Long userId,
        String permissionCode,
        String resourceType,
        String resourceId,
        Long grantedBy,
        Long sourceRequestId,
        String status,
        Instant effectiveFrom,
        Instant effectiveTo,
        Instant createdAt
) {
}
