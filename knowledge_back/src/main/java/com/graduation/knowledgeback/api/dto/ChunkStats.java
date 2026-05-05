package com.graduation.knowledgeback.api.dto;

public record ChunkStats(
        Integer totalChunks,
        Integer averageLength,
        Integer overlap,
        Integer chunkSize
) {
}
