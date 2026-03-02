package com.graduation.knowledgeback.service;

import com.graduation.knowledgeback.domain.ChunkHit;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;

public final class RrfFusion {
    private RrfFusion() {
    }

    public static List<Fused> fuse(List<ChunkHit> keywordHits, List<ChunkHit> vectorHits, int topK, int rrfK) {
        var scoreById = new HashMap<String, Double>();
        var kwRank = new HashMap<String, Integer>();
        var vecRank = new HashMap<String, Integer>();
        var hitById = new LinkedHashMap<String, ChunkHit>();

        for (int i = 0; i < keywordHits.size(); i++) {
            var h = keywordHits.get(i);
            if (h.chunkId() == null) continue;
            kwRank.put(h.chunkId(), i + 1);
            hitById.putIfAbsent(h.chunkId(), h);
        }
        for (int i = 0; i < vectorHits.size(); i++) {
            var h = vectorHits.get(i);
            if (h.chunkId() == null) continue;
            vecRank.put(h.chunkId(), i + 1);
            hitById.putIfAbsent(h.chunkId(), h);
        }

        for (var id : hitById.keySet()) {
            double s = 0.0;
            var r1 = kwRank.get(id);
            var r2 = vecRank.get(id);
            if (r1 != null) s += 1.0 / (rrfK + r1);
            if (r2 != null) s += 1.0 / (rrfK + r2);
            scoreById.put(id, s);
        }

        var fused = new ArrayList<Fused>(hitById.size());
        for (var e : hitById.entrySet()) {
            var id = e.getKey();
            var hit = e.getValue();
            var rSource = retrievalSource(kwRank.containsKey(id), vecRank.containsKey(id));
            fused.add(new Fused(hit, scoreById.getOrDefault(id, 0.0), rSource));
        }

        fused.sort((a, b) -> Double.compare(b.fusedScore(), a.fusedScore()));
        if (fused.size() > topK) {
            return fused.subList(0, topK);
        }
        return fused;
    }

    private static String retrievalSource(boolean inKw, boolean inVec) {
        if (inKw && inVec) return "hybrid";
        if (inKw) return "keyword";
        if (inVec) return "vector";
        return "hybrid";
    }

    public record Fused(ChunkHit hit, double fusedScore, String retrievalSource) {
    }
}
