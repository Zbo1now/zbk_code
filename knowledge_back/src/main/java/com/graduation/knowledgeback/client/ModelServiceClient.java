package com.graduation.knowledgeback.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.config.AppProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;

@Component
public class ModelServiceClient {
    private final WebClient webClient;
    private final ObjectMapper snakeMapper;

    public ModelServiceClient(
            WebClient.Builder builder,
            @Qualifier("snakeCaseObjectMapper") ObjectMapper snakeCaseObjectMapper,
            AppProperties props
    ) {
        this.webClient = builder.baseUrl(props.modelService().baseUrl()).build();
        this.snakeMapper = snakeCaseObjectMapper;
    }

    public List<Float> embedSingle(String text) {
        var req = snakeMapper.createObjectNode();
        req.putArray("texts").add(text);
        var resp = webClient.post()
                .uri("/embed")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(15));

        if (resp == null || resp.get("vectors") == null || !resp.get("vectors").isArray() || resp.get("vectors").isEmpty()) {
            throw new IllegalStateException("ModelService /embed returned empty vectors");
        }
        var vec0 = resp.get("vectors").get(0);
        if (!vec0.isArray()) {
            throw new IllegalStateException("ModelService /embed vectors[0] is not an array");
        }
        var out = new java.util.ArrayList<Float>(vec0.size());
        for (var v : vec0) {
            out.add((float) v.asDouble());
        }
        return out;
    }

    public List<List<Float>> embedBatch(List<String> texts) {
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }
        var req = snakeMapper.createObjectNode();
        var arr = req.putArray("texts");
        for (var t : texts) {
            arr.add(t);
        }
        var resp = webClient.post()
                .uri("/embed")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(30));

        if (resp == null || resp.get("vectors") == null || !resp.get("vectors").isArray()) {
            throw new IllegalStateException("ModelService /embed returned invalid vectors");
        }
        var vectors = resp.get("vectors");
        var out = new java.util.ArrayList<List<Float>>(vectors.size());
        for (var vec : vectors) {
            var one = new java.util.ArrayList<Float>(vec.size());
            for (var v : vec) {
                one.add((float) v.asDouble());
            }
            out.add(one);
        }
        return out;
    }

    public JsonNode rerank(String query, List<Item> items, int topK) {
        var req = snakeMapper.createObjectNode();
        req.put("query", query);
        var arr = req.putArray("items");
        for (var item : items) {
            var obj = snakeMapper.createObjectNode();
            obj.put("doc_id", item.id());
            obj.put("text", item.text());
            arr.add(obj);
        }
        req.put("top_k", topK);

        return webClient.post()
                .uri("/rerank")
                .bodyValue(req)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(30));
    }

    public JsonNode health() {
        return webClient.get()
                .uri("/health")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(5));
    }

    public record Item(String id, String text) {
    }
}
