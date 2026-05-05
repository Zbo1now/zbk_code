package com.graduation.knowledgeback.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Elasticsearch elasticsearch,
        Qdrant qdrant,
        ModelService modelService,
        Indexing indexing,
        Llm llm,
        Auth auth
) {
    public record Elasticsearch(String baseUrl, String index) {
    }

    public record Qdrant(String baseUrl, String collection) {
    }

    public record ModelService(String baseUrl) {
    }

    public record Indexing(String sourceJsonlPath, Integer embedBatchSize) {
    }

    public record Llm(String baseUrl, String apiKey, String model) {
    }

    public record Auth(String tokenSecret, Long tokenTtlSeconds) {
    }
}
