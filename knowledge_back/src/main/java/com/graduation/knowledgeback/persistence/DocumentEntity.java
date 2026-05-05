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
    @Column(name = "doc_id", length = 64)
    private String docId;

    @Column(name = "knowledge_base_id")
    private Long knowledgeBaseId;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "uploaded_by")
    private Long uploadedBy;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "stored_path", nullable = false)
    private String storedPath;

    @Column(name = "display_name", length = 255)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "metadata_json", columnDefinition = "CLOB")
    private String metadataJson;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "file_type", length = 50)
    private String fileType;

    @Column(length = 64)
    private String checksum;

    @Column(name = "machine_type", length = 100)
    private String machineType;

    @Column(nullable = false)
    private boolean hidden = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "error_message")
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
    public Long getKnowledgeBaseId() { return knowledgeBaseId; }
    public Long getCategoryId() { return categoryId; }
    public Long getUploadedBy() { return uploadedBy; }
    public Long getReviewedBy() { return reviewedBy; }
    public Instant getReviewedAt() { return reviewedAt; }
    
    public void setStatus(DocumentStatus status) { this.status = status; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public void setMachineType(String machineType) { this.machineType = machineType; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }
    public void setKnowledgeBaseId(Long knowledgeBaseId) { this.knowledgeBaseId = knowledgeBaseId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public void setUploadedBy(Long uploadedBy) { this.uploadedBy = uploadedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    
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
