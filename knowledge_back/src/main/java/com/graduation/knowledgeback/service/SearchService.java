package com.graduation.knowledgeback.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.api.dto.PipelineSearchRequest;
import com.graduation.knowledgeback.api.dto.PipelineSearchResponse;
import com.graduation.knowledgeback.api.dto.SearchResultItem;
import com.graduation.knowledgeback.api.dto.SingleSearchRequest;
import com.graduation.knowledgeback.api.dto.SingleSearchResponse;
import com.graduation.knowledgeback.client.ElasticsearchClient;
import com.graduation.knowledgeback.client.ModelServiceClient;
import com.graduation.knowledgeback.client.QdrantClient;
import com.graduation.knowledgeback.domain.ChunkHit;
import com.graduation.knowledgeback.persistence.SearchLogEntity;
import com.graduation.knowledgeback.persistence.SearchLogRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SearchService {
    private final ElasticsearchClient elasticsearchClient;
    private final QdrantClient qdrantClient;
    private final ModelServiceClient modelServiceClient;
    private final ObjectMapper objectMapper;
    private final SearchLogRepository searchLogRepository;

    public SearchService(
            ElasticsearchClient elasticsearchClient,
            QdrantClient qdrantClient,
            ModelServiceClient modelServiceClient,
            ObjectMapper objectMapper,
            SearchLogRepository searchLogRepository
    ) {
        this.elasticsearchClient = elasticsearchClient;
        this.qdrantClient = qdrantClient;
        this.modelServiceClient = modelServiceClient;
        this.objectMapper = objectMapper;
        this.searchLogRepository = searchLogRepository;
    }

    public PipelineSearchResponse pipeline(PipelineSearchRequest req) {
        var searchId = UUID.randomUUID().toString();
        var t0 = System.nanoTime();

        int topK = req.topK();
        int candidateK = Math.min(Math.max(topK * 10, 30), 200);
        int rrfK = 60;

        long keywordMs;
        long vectorMs;
        long rrfMs;
        long rerankMs = 0;

        var filters = normalizeFilters(req.filters());

        var t1 = System.nanoTime();
        var kwJson = elasticsearchClient.searchContent(req.query(), candidateK, filters);
        var keywordHits = parseEsHits(kwJson);
        keywordMs = Duration.ofNanos(System.nanoTime() - t1).toMillis();

        var t2 = System.nanoTime();
        var qVec = modelServiceClient.embedSingle(req.query());
        var vecJson = qdrantClient.queryPoints(qVec, candidateK, filters);
        var vectorHits = parseQdrantHits(vecJson);
        vectorMs = Duration.ofNanos(System.nanoTime() - t2).toMillis();

        var t3 = System.nanoTime();
        var fused = RrfFusion.fuse(keywordHits, vectorHits, candidateK, rrfK);
        rrfMs = Duration.ofNanos(System.nanoTime() - t3).toMillis();

        List<SearchResultItem> results;
        if (Boolean.TRUE.equals(req.useRerank())) {
            var t4 = System.nanoTime();
            results = rerankAndBuild(req.query(), fused, topK);
            rerankMs = Duration.ofNanos(System.nanoTime() - t4).toMillis();
        } else {
            results = buildFromFused(fused, topK, false, Map.of());
        }

        var totalMs = Duration.ofNanos(System.nanoTime() - t0).toMillis();
        var timing = new HashMap<String, Long>();
        timing.put("keywordMs", keywordMs);
        timing.put("vectorMs", vectorMs);
        timing.put("rrfMs", rrfMs);
        if (Boolean.TRUE.equals(req.useRerank())) {
            timing.put("rerankMs", rerankMs);
        }

        // --- 开始记录日志 ---
        try {
            // 模型延迟 = 向量检索（通常隐式或显式包含嵌入时间） + 重排
            // 为了精确计时，vectorMs 包括嵌入 + qdrant 检索。
            long modelTotalMs = vectorMs + rerankMs;
            
            // ES 延迟 = 关键词检索
            long esTotalMs = keywordMs;

            SearchLogEntity log = new SearchLogEntity(
                searchId,
                null, // user_id 在此上下文中未知，如果需要可以传递
                req.query(),
                "HYBRID", // 默认为 HYBRID，因为代码同时执行了两者
                Boolean.TRUE.equals(req.useRerank()),
                results.size(),
                (int) totalMs,
                (int) esTotalMs,
                (int) modelTotalMs,
                Instant.now()
            );
            searchLogRepository.save(log);
        } catch (Exception e) {
            System.err.println("Failed to save search log: " + e.getMessage());
        }
        // --- 结束记录日志 ---
        return new PipelineSearchResponse(searchId, req.query(), totalMs, timing, results);
    }

    private Map<String, String> normalizeFilters(Map<String, String> filters) {
        if (filters == null || filters.isEmpty()) return Map.of();

        // 将请求的 key (camelCase) 映射到 payload 字段的 key (snake_case)
        return filters.entrySet().stream()
                .filter(e -> e.getKey() != null && e.getValue() != null)
                .filter(e -> !e.getKey().isBlank() && !e.getValue().isBlank())
                .collect(Collectors.toMap(
                        e -> mapFilterKey(e.getKey()),
                        Map.Entry::getValue,
                        (a, b) -> b
                ));
    }

    private String mapFilterKey(String key) {
        // API 设计中的已知别名
        if ("docType".equals(key)) return "file_type";
        if ("machineType".equals(key)) return "machine_type";
        // 回退策略：camelCase -> snake_case
        return camelToSnake(key);
    }

    private String camelToSnake(String s) {
        if (s == null || s.isBlank()) return s;
        var sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isUpperCase(c)) {
                sb.append('_').append(Character.toLowerCase(c));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    public SingleSearchResponse single(SingleSearchRequest req) {
        var searchId = UUID.randomUUID().toString();
        var t0 = System.nanoTime();
        int topK = req.topK();

        List<SearchResultItem> results;
        if ("keyword".equalsIgnoreCase(req.mode())) {
            var json = elasticsearchClient.searchContent(req.query(), topK);
            var hits = parseEsHits(json);
            var fused = RrfFusion.fuse(hits, List.of(), topK, 60);
            results = buildFromFused(fused, topK, false, Map.of());
        } else if ("vector".equalsIgnoreCase(req.mode())) {
            var vec = modelServiceClient.embedSingle(req.query());
            var json = qdrantClient.queryPoints(vec, topK);
            var hits = parseQdrantHits(json);
            var fused = RrfFusion.fuse(List.of(), hits, topK, 60);
            results = buildFromFused(fused, topK, false, Map.of());
        } else {
            throw new IllegalArgumentException("mode must be 'keyword' or 'vector'");
        }

        var totalMs = Duration.ofNanos(System.nanoTime() - t0).toMillis();
        return new SingleSearchResponse(searchId, req.query(), req.mode(), totalMs, results);
    }

    private List<SearchResultItem> rerankAndBuild(String query, List<RrfFusion.Fused> fused, int topK) {
        var candidates = fused;
        var items = new ArrayList<ModelServiceClient.Item>(candidates.size());
        for (var f : candidates) {
            var hit = f.hit();
            items.add(new ModelServiceClient.Item(hit.chunkId(), hit.content()));
        }

        var resp = modelServiceClient.rerank(query, items, Math.min(topK, 200));
        var scores = new HashMap<String, Double>();
        if (resp != null && resp.get("results") != null && resp.get("results").isArray()) {
            for (var r : resp.get("results")) {
                var id = r.get("doc_id");
                var sc = r.get("score");
                if (id != null && sc != null) {
                    scores.put(id.asText(), sc.asDouble());
                }
            }
        }
        return buildFromFused(candidates, topK, true, scores);
    }

    private List<SearchResultItem> buildFromFused(List<RrfFusion.Fused> fused, int topK, boolean preferRerank, Map<String, Double> rerankScores) {
        var list = new ArrayList<SearchResultItem>(Math.min(topK, fused.size()));
        var sorted = new ArrayList<>(fused);
        if (preferRerank && !rerankScores.isEmpty()) {
            sorted.sort((a, b) -> Double.compare(
                    rerankScores.getOrDefault(b.hit().chunkId(), Double.NEGATIVE_INFINITY),
                    rerankScores.getOrDefault(a.hit().chunkId(), Double.NEGATIVE_INFINITY)
            ));
        }

        int rank = 1;
        for (var f : sorted) {
            if (rank > topK) break;
            var hit = f.hit();
            var score = preferRerank ? rerankScores.getOrDefault(hit.chunkId(), f.fusedScore()) : f.fusedScore();
            list.add(new SearchResultItem(
                    rank,
                    score,
                    hit.content(),
                    hit.source(),
                    hit.pageNum(),
                    hit.pageNum(),
                    hit.docId(),
                    hit.chunkIds(),
                    f.retrievalSource()
            ));
            rank++;
        }
        return list;
    }

    private List<ChunkHit> parseEsHits(JsonNode root) {
        if (root == null) return List.of();
        var hits = root.path("hits").path("hits");
        if (!hits.isArray()) return List.of();

        var out = new ArrayList<ChunkHit>();
        for (var h : hits) {
            var score = h.path("_score").isNumber() ? h.path("_score").asDouble() : null;
            var src = h.path("_source");
            var chunkId = textOrNull(src.get("chunk_id"));
            var docId = textOrNull(src.get("doc_id"));
            var source = textOrNull(src.get("source"));
            var content = textOrNull(src.get("content"));
            var pageNum = src.get("page_num") != null && src.get("page_num").isNumber() ? src.get("page_num").asInt() : null;
            if (chunkId == null || content == null) continue;
            out.add(new ChunkHit(chunkId, docId, source, pageNum, content, score, asMap(src)));
        }
        return out;
    }

    private List<ChunkHit> parseQdrantHits(JsonNode root) {
        if (root == null) return List.of();
        JsonNode points = null;
        if (root.get("result") != null && root.get("result").get("points") != null) {
            points = root.get("result").get("points");
        } else if (root.get("result") != null && root.get("result").isArray()) {
            points = root.get("result");
        } else if (root.get("points") != null) {
            points = root.get("points");
        }
        if (points == null || !points.isArray()) return List.of();

        var out = new ArrayList<ChunkHit>();
        for (var p : points) {
            var score = p.get("score") != null && p.get("score").isNumber() ? p.get("score").asDouble() : null;
            var payload = p.get("payload");
            if (payload == null || !payload.isObject()) continue;
            var chunkId = textOrNull(payload.get("chunk_id"));
            var docId = textOrNull(payload.get("doc_id"));
            var source = textOrNull(payload.get("source"));
            var content = textOrNull(payload.get("content"));
            var pageNum = payload.get("page_num") != null && payload.get("page_num").canConvertToInt() ? payload.get("page_num").asInt() : null;
            if (chunkId == null || content == null) continue;
            out.add(new ChunkHit(chunkId, docId, source, pageNum, content, score, asMap(payload)));
        }
        return out;
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (!node.isTextual()) return node.asText(null);
        return node.asText();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(JsonNode obj) {
        try {
            return objectMapper.convertValue(obj, Map.class);
        } catch (Exception ignore) {
            return Map.of();
        }
    }
}
