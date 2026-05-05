package com.graduation.knowledgeback.api.dto;

public record ChunkPreviewItem(
        String chunkId,
        Integer chunkIndex,
        Integer pageNum,
        Integer length,
        String title,
        String content
) {
}
