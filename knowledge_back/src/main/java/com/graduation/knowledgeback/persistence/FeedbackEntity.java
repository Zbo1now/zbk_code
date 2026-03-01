package com.graduation.knowledgeback.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "feedback")
public class FeedbackEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String searchId;

    @Column(length = 64)
    private String docId;

    @Column(length = 128)
    private String chunkId;

    @Column
    private Integer rank;

    @Column(nullable = false)
    private boolean isRelevant;

    @Column(nullable = false)
    private Instant createdAt;

    protected FeedbackEntity() {
    }

    public FeedbackEntity(String searchId, String docId, String chunkId, Integer rank, boolean isRelevant) {
        this.searchId = searchId;
        this.docId = docId;
        this.chunkId = chunkId;
        this.rank = rank;
        this.isRelevant = isRelevant;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }
}
