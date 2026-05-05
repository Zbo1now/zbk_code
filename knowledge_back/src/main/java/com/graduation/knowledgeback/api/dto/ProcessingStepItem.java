package com.graduation.knowledgeback.api.dto;

import java.time.Instant;

public record ProcessingStepItem(
        String step,
        String status,
        String message,
        Instant startedAt,
        Instant finishedAt
) {
}
