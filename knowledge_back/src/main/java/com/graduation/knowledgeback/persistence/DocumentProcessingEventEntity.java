package com.graduation.knowledgeback.persistence;

import com.graduation.knowledgeback.domain.ProcessingEventStatus;
import com.graduation.knowledgeback.domain.ProcessingStep;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "document_processing_event")
public class DocumentProcessingEventEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String docId;

    @Column(nullable = false, length = 50)
    private String fileType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ProcessingStep step;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProcessingEventStatus status;

    @Column(length = 255)
    private String message;

    @Column(columnDefinition = "TEXT")
    private String payloadJson;

    @Column
    private Instant startedAt;

    @Column
    private Instant finishedAt;

    @Column(nullable = false)
    private Instant createdAt;

    public DocumentProcessingEventEntity() {
    }

    public Long getId() {
        return id;
    }

    public String getDocId() {
        return docId;
    }

    public void setDocId(String docId) {
        this.docId = docId;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public ProcessingStep getStep() {
        return step;
    }

    public void setStep(ProcessingStep step) {
        this.step = step;
    }

    public ProcessingEventStatus getStatus() {
        return status;
    }

    public void setStatus(ProcessingEventStatus status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
