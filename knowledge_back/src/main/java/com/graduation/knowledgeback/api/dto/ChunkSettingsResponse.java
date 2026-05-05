package com.graduation.knowledgeback.api.dto;

public record ChunkSettingsResponse(
        Integer chunkSize,
        Integer overlap,
        Integer defaultChunkSize,
        Integer defaultOverlap
) {
}
