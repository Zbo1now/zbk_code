package com.graduation.knowledgeback.persistence;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "qa_logs")
public class QaLogEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String query;

    @Column(columnDefinition = "TEXT")
    private String answer;

    @Column(nullable = false)
    private Long durationMs;

    @Column(nullable = false)
    private Integer sourceCount;

    @Column(nullable = false)
    private Instant timestamp;

    public QaLogEntity() {
    }

    public QaLogEntity(String query, String answer, Long durationMs, Integer sourceCount, Instant timestamp) {
        this.query = query;
        this.answer = answer;
        this.durationMs = durationMs;
        this.sourceCount = sourceCount;
        this.timestamp = timestamp;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public Integer getSourceCount() {
        return sourceCount;
    }

    public void setSourceCount(Integer sourceCount) {
        this.sourceCount = sourceCount;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
