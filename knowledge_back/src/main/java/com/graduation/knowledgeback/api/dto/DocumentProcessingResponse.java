package com.graduation.knowledgeback.api.dto;

import java.time.Instant;
import java.util.List;

public record DocumentProcessingResponse(
        String docId,
        String fileType,
        String documentStatus,
        boolean supported,
        String currentStep,
        String currentStatus,
        String message,
        Instant updatedAt,
        List<ProcessingStepItem> steps,
        ChunkStats chunkStats,
        List<ChunkPreviewItem> chunkPreview,
        String errorMessage
) {
}
