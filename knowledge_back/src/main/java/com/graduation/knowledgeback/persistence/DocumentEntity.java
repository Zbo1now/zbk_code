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

    @Column(length = 255)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "CLOB")
    private String metadataJson;

    @Column
    private Long fileSize;

    @Column(length = 50)
    private String fileType;

    @Column(length = 64)
    private String checksum;

    @Column(length = 100)
    private String machineType;

    @Column(nullable = false)
    private boolean hidden = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    @Column
    private String errorMessage;

    public DocumentEntity() {
    }

    public DocumentEntity(String docId, String originalFilename, String storedPath, String metadataJson,
            Long fileSize, String fileType, String checksum, String machineType) {
        this.docId = docId;
        this.originalFilename = originalFilename;
        this.storedPath = storedPath;
        this.metadataJson = metadataJson;
        this.fileSize = fileSize;
        this.fileType = fileType;
        this.checksum = checksum;
        this.machineType = machineType;
        this.status = DocumentStatus.UPLOADED;
        this.createdAt = Instant.now();
        this.hidden = false;
    }

    public DocumentEntity(String docId, String originalFilename, String storedPath, String metadataJson) {
        this(docId, originalFilename, storedPath, metadataJson, null, null, null, null);
    }

    // Setters for controller compatibility
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public void setStoredPath(String storedPath) { this.storedPath = storedPath; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public void setDescription(String description) { this.description = description; }
    public void setMetadata(String metadataJson) { this.metadataJson = metadataJson; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public void setFileType(String fileType) { this.fileType = fileType; }
    public void setChecksum(String checksum) { this.checksum = checksum; }
    public void setUploadTime(java.time.LocalDateTime dt) { 
        if (dt != null) this.createdAt = dt.toInstant(java.time.ZoneOffset.UTC); 
    }
    public void setId(String id) { this.docId = id; }
    public String getId() { return docId; }

    // Getters
    public String getDocId() { return docId; }
    public String getOriginalFilename() { return originalFilename; }
    public String getStoredPath() { return storedPath; }
    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
    public String getMetadataJson() { return metadataJson; }
    public DocumentStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public String getErrorMessage() { return errorMessage; }
    public Long getFileSize() { return fileSize; }
    public String getFileType() { return fileType; }
    public String getChecksum() { return checksum; }
    public String getMachineType() { return machineType; }
    public boolean isHidden() { return hidden; }
    
    public void setStatus(DocumentStatus status) { this.status = status; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public void setMachineType(String machineType) { this.machineType = machineType; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }
    
    public void updateBasicInfo(String originalFilename, String storedPath, String metadataJson, Long fileSize,
            String fileType, String checksum, String machineType) {
        this.originalFilename = originalFilename;
        this.storedPath = storedPath;
        this.metadataJson = metadataJson;
        this.fileSize = fileSize;
        this.fileType = fileType;
        this.checksum = checksum;
        this.machineType = machineType;
    }

    public void updateBasicInfo(String originalFilename, String storedPath, String metadataJson) {
        // compatibility method
        this.originalFilename = originalFilename;
        this.storedPath = storedPath;
        this.metadataJson = metadataJson;
    }
}
