package com.graduation.knowledgeback.api.dto;

public record ChunkSettingsRequest(
        Integer chunkSize,
        Integer overlap
) {
}
