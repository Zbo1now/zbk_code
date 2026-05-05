package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.NotBlank;

public record AdminPermissionReviewRequest(
        @NotBlank(message = "审批动作不能为空")
        String action,
        String reviewComment,
        String effectiveTo
) {
}
