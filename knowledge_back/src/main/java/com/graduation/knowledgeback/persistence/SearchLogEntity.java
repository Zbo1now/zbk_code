package com.graduation.knowledgeback.persistence;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "search_logs")
public class SearchLogEntity {
    @Id
    @Column(name = "log_id", length = 64)
    private String logId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "query_text", columnDefinition = "TEXT", nullable = false)
    private String queryText;

    @Column(name = "search_mode", length = 50, nullable = false)
    private String searchMode;

    @Column(name = "has_rerank")
    private Boolean hasRerank;

    @Column(name = "result_count")
    private Integer resultCount;

    @Column(name = "total_latency")
    private Integer totalLatency;

    @Column(name = "es_latency")
    private Integer esLatency; // Keyword search latency

    @Column(name = "model_latency")
    private Integer modelLatency; // Embedding + Rerank latency

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public SearchLogEntity() {
    }

    public SearchLogEntity(String logId, Long userId, String queryText, String searchMode, Boolean hasRerank, Integer resultCount, Integer totalLatency, Integer esLatency, Integer modelLatency, Instant createdAt) {
        this.logId = logId;
        this.userId = userId;
        this.queryText = queryText;
        this.searchMode = searchMode;
        this.hasRerank = hasRerank;
        this.resultCount = resultCount;
        this.totalLatency = totalLatency;
        this.esLatency = esLatency;
        this.modelLatency = modelLatency;
        this.createdAt = createdAt;
    }

    // Getters and Setters

    public String getLogId() {
        return logId;
    }

    public void setLogId(String logId) {
        this.logId = logId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getQueryText() {
        return queryText;
    }

    public void setQueryText(String queryText) {
        this.queryText = queryText;
    }

    public String getSearchMode() {
        return searchMode;
    }

    public void setSearchMode(String searchMode) {
        this.searchMode = searchMode;
    }

    public Boolean getHasRerank() {
        return hasRerank;
    }

    public void setHasRerank(Boolean hasRerank) {
        this.hasRerank = hasRerank;
    }

    public Integer getResultCount() {
        return resultCount;
    }

    public void setResultCount(Integer resultCount) {
        this.resultCount = resultCount;
    }

    public Integer getTotalLatency() {
        return totalLatency;
    }

    public void setTotalLatency(Integer totalLatency) {
        this.totalLatency = totalLatency;
    }

    public Integer getEsLatency() {
        return esLatency;
    }

    public void setEsLatency(Integer esLatency) {
        this.esLatency = esLatency;
    }

    public Integer getModelLatency() {
        return modelLatency;
    }

    public void setModelLatency(Integer modelLatency) {
        this.modelLatency = modelLatency;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
