package com.graduation.knowledgeback.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.config.AppProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
public class QdrantClient {
    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final AppProperties.Qdrant props;

    public QdrantClient(WebClient.Builder builder, ObjectMapper objectMapper, AppProperties appProperties) {
        this.webClient = builder.baseUrl(appProperties.qdrant().baseUrl()).build();
        this.objectMapper = objectMapper;
        this.props = appProperties.qdrant();
    }

    public JsonNode queryPoints(List<Float> vector, int limit) {
        return queryPoints(vector, limit, null);
    }

    public JsonNode queryPoints(List<Float> vector, int limit, Map<String, String> filters) {
        var body = objectMapper.createObjectNode();
        var arr = body.putArray("query");
        for (var v : vector) {
            arr.add(v);
        }
        body.put("limit", limit);
        body.put("with_payload", true);

        if (filters != null && !filters.isEmpty()) {
            var filter = body.putObject("filter");
            var must = filter.putArray("must");
            for (var e : filters.entrySet()) {
                if (e.getKey() == null || e.getValue() == null) continue;
                var key = e.getKey();
                var val = e.getValue();
                if (key.isBlank() || val.isBlank()) continue;
                var cond = objectMapper.createObjectNode();
                cond.put("key", key);
                cond.putObject("match").put("value", val);
                must.add(cond);
            }
        }

        return webClient.post()
                .uri("/collections/{collection}/points/query", props.collection())
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(10));
    }

    public JsonNode collectionInfo() {
        return webClient.get()
                .uri("/collections/{collection}", props.collection())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(5));
    }

    public void deleteCollectionIfExists() {
        webClient.delete()
                .uri("/collections/{collection}", props.collection())
                .retrieve()
                .toBodilessEntity()
                .onErrorResume(e -> reactor.core.publisher.Mono.empty())
                .block(Duration.ofSeconds(20));
    }

    public void createCollection(int vectorSize) {
        var body = objectMapper.createObjectNode();
        body.putObject("vectors")
                .put("size", vectorSize)
                .put("distance", "Cosine");
        webClient.put()
                .uri("/collections/{collection}", props.collection())
                .bodyValue(body)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(20));
    }

    public void upsertPoints(JsonNode pointsBody) {
        webClient.put()
                .uri("/collections/{collection}/points?wait=true", props.collection())
                .bodyValue(pointsBody)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(60));
    }

    public void deleteByDocId(String docId) {
        if (docId == null || docId.isBlank()) return;
        var body = objectMapper.createObjectNode();
        var filter = body.putObject("filter");
        var must = filter.putArray("must");
        var cond = objectMapper.createObjectNode();
        cond.put("key", "doc_id");
        cond.putObject("match").put("value", docId);
        must.add(cond);
        body.put("wait", true);
        webClient.post()
                .uri("/collections/{collection}/points/delete", props.collection())
                .bodyValue(body)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(60));
    }
}
