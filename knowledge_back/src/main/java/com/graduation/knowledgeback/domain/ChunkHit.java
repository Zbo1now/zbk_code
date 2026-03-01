package com.graduation.knowledgeback.domain;

import java.util.List;
import java.util.Map;

public record ChunkHit(
        String chunkId,
        String docId,
        String source,
        Integer pageNum,
        String content,
        Double score,
        Map<String, Object> payload
) {
    public List<String> chunkIds() {
        return List.of(chunkId);
    }
}
