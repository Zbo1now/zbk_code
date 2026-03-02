package com.graduation.knowledgeback.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.config.AppProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

@Component
public class ElasticsearchClient {
    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final AppProperties.Elasticsearch props;

    public ElasticsearchClient(WebClient.Builder builder, ObjectMapper objectMapper, AppProperties appProperties) {
        this.webClient = builder.baseUrl(appProperties.elasticsearch().baseUrl()).build();
        this.objectMapper = objectMapper;
        this.props = appProperties.elasticsearch();
    }

    public String indexName() {
        return props.index();
    }

    public JsonNode searchContent(String query, int size) {
        return searchContent(query, size, null);
    }

    public JsonNode searchContent(String query, int size, Map<String, String> filters) {
        var body = objectMapper.createObjectNode();
        body.put("size", size);
        var queryNode = body.putObject("query");
        if (filters == null || filters.isEmpty()) {
            var match = queryNode.putObject("match");
            match.putObject("content").put("query", query);
        } else {
            var bool = queryNode.putObject("bool");
            var must = bool.putArray("must");
            must.add(objectMapper.createObjectNode()
                    .putObject("match")
                    .putObject("content")
                    .put("query", query));

            var filterArr = bool.putArray("filter");
            for (var e : filters.entrySet()) {
                if (e.getKey() == null || e.getValue() == null) continue;
                var key = e.getKey();
                var val = e.getValue();
                if (key.isBlank() || val.isBlank()) continue;
                filterArr.add(objectMapper.createObjectNode()
                        .putObject("term")
                        .putObject(key)
                        .put("value", val));
            }
        }
        return webClient.post()
                .uri("/{index}/_search", props.index())
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(10));
    }

    public JsonNode clusterHealth() {
        return webClient.get()
                .uri("/_cluster/health")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(5));
    }

    public Integer indexCount() {
        var indices = webClient.get()
                .uri("/_cat/indices?format=json")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(5));
        if (indices != null && indices.isArray()) {
            return indices.size();
        }
        return null;
    }

    public boolean indexExists() {
        return Boolean.TRUE.equals(webClient.get()
                .uri("/{index}", props.index())
                .exchangeToMono(resp -> resp.statusCode().is2xxSuccessful() ? reactor.core.publisher.Mono.just(true) : reactor.core.publisher.Mono.just(false))
                .onErrorReturn(false)
                .block(Duration.ofSeconds(5)));
    }

    public void deleteIndexIfExists() {
        webClient.delete()
                .uri("/{index}", props.index())
                .retrieve()
                .toBodilessEntity()
                .onErrorResume(e -> reactor.core.publisher.Mono.empty())
                .block(Duration.ofSeconds(10));
    }

    public void createIndex() {
        var mapping = objectMapper.createObjectNode();
        var mappings = mapping.putObject("mappings");
        var propsNode = mappings.putObject("properties");
        propsNode.putObject("chunk_id").put("type", "keyword");
        propsNode.putObject("doc_id").put("type", "keyword");
        propsNode.putObject("source").put("type", "keyword");
        propsNode.putObject("file_type").put("type", "keyword");
        propsNode.putObject("page_num").put("type", "integer");
        propsNode.putObject("title").put("type", "text");
        propsNode.putObject("section_title").put("type", "text");
        propsNode.putObject("anchor_text").put("type", "text");
        propsNode.putObject("content").put("type", "text");

        webClient.put()
                .uri("/{index}", props.index())
                .bodyValue(mapping)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(10));
    }

    public void bulkIndexNdjson(String ndjson) {
        webClient.post()
                .uri("/_bulk")
                .header("Content-Type", "application/x-ndjson")
                .bodyValue(ndjson)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(60));
    }

    public void deleteByDocId(String docId) {
        var body = objectMapper.createObjectNode();
        var query = body.putObject("query");
        query.putObject("term").putObject("doc_id").put("value", docId);
        webClient.post()
                .uri("/{index}/_delete_by_query", props.index())
                .bodyValue(body)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(60));
    }
}
