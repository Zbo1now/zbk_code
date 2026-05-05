package com.graduation.knowledgeback.api.dto;

import java.util.List;

public record ChunkPreviewResponse(
        String docId,
        boolean supported,
        String message,
        ChunkStats chunkStats,
        List<ChunkPreviewItem> chunks
) {
}
