package com.graduation.knowledgeback.persistence;

import com.graduation.knowledgeback.domain.DocumentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "documents")
public class DocumentEntity {
    @Id
    @Column(length = 64)
    private String docId;

    @Column(nullable = false)
    private String originalFilename;

    @Column(nullable = false)
    private String storedPath;

    @Column(columnDefinition = "CLOB")
    private String metadataJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    @Column
    private String errorMessage;

    protected DocumentEntity() {
    }

    public DocumentEntity(String docId, String originalFilename, String storedPath, String metadataJson) {
        this.docId = docId;
        this.originalFilename = originalFilename;
        this.storedPath = storedPath;
        this.metadataJson = metadataJson;
        this.status = DocumentStatus.UPLOADED;
        this.createdAt = Instant.now();
    }

    public void updateBasicInfo(String originalFilename, String storedPath, String metadataJson) {
        if (originalFilename != null && !originalFilename.isBlank()) {
            this.originalFilename = originalFilename;
        }
        if (storedPath != null && !storedPath.isBlank()) {
            this.storedPath = storedPath;
        }
        this.metadataJson = metadataJson;
    }

    public String getDocId() {
        return docId;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public String getStoredPath() {
        return storedPath;
    }

    public String getMetadataJson() {
        return metadataJson;
    }

    public DocumentStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setStatus(DocumentStatus status) {
        this.status = status;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
