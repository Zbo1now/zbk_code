package com.graduation.knowledgeback.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.api.dto.ChunkPreviewItem;
import com.graduation.knowledgeback.api.dto.ChunkStats;
import com.graduation.knowledgeback.api.dto.DocumentProcessingResponse;
import com.graduation.knowledgeback.api.dto.ProcessingStepItem;
import com.graduation.knowledgeback.domain.DocumentStatus;
import com.graduation.knowledgeback.domain.ProcessingEventStatus;
import com.graduation.knowledgeback.domain.ProcessingStep;
import com.graduation.knowledgeback.persistence.DocumentEntity;
import com.graduation.knowledgeback.persistence.DocumentProcessingEventEntity;
import com.graduation.knowledgeback.persistence.DocumentProcessingEventRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DocumentProcessingTracker {
    private static final List<ProcessingStep> STEP_ORDER = List.of(
            ProcessingStep.UPLOAD,
            ProcessingStep.REVIEW,
            ProcessingStep.PARSE,
            ProcessingStep.CHUNK,
            ProcessingStep.EMBED,
            ProcessingStep.INDEX_ES,
            ProcessingStep.INDEX_QDRANT,
            ProcessingStep.COMPLETE
    );

    private final DocumentProcessingEventRepository repository;
    private final ObjectMapper objectMapper;

    public DocumentProcessingTracker(
            DocumentProcessingEventRepository repository,
            ObjectMapper objectMapper,
            JdbcTemplate jdbcTemplate
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS document_processing_event (
                  id BIGINT NOT NULL AUTO_INCREMENT,
                  doc_id VARCHAR(64) NOT NULL,
                  file_type VARCHAR(50) NOT NULL,
                  step VARCHAR(50) NOT NULL,
                  status VARCHAR(20) NOT NULL,
                  message VARCHAR(255) DEFAULT NULL,
                  payload_json TEXT,
                  started_at TIMESTAMP NULL,
                  finished_at TIMESTAMP NULL,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (id),
                  INDEX idx_doc_id (doc_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
    }

    public void recordUpload(DocumentEntity doc, boolean autoApproved) {
        record(doc, ProcessingStep.UPLOAD, ProcessingEventStatus.SUCCESS, "文件上传成功", Map.of(
                "supported", isWordDocument(doc),
                "fileType", normalizedFileType(doc)
        ));
        if (!autoApproved) {
            record(doc, ProcessingStep.REVIEW, ProcessingEventStatus.PENDING, "等待管理员审核", null);
        }
    }

    public void recordReview(DocumentEntity doc, boolean approved) {
        record(
                doc,
                ProcessingStep.REVIEW,
                approved ? ProcessingEventStatus.SUCCESS : ProcessingEventStatus.FAILED,
                approved ? "审核通过，开始处理" : "文档审核未通过",
                approved ? Map.of("supported", isWordDocument(doc)) : null
        );
    }

    public void markRunning(DocumentEntity doc, ProcessingStep step, String message) {
        record(doc, step, ProcessingEventStatus.RUNNING, message, null);
    }

    public void markSuccess(DocumentEntity doc, ProcessingStep step, String message, Map<String, Object> payload) {
        record(doc, step, ProcessingEventStatus.SUCCESS, message, payload);
    }

    public void markFailed(DocumentEntity doc, ProcessingStep step, String message) {
        record(doc, step, ProcessingEventStatus.FAILED, message, null);
    }

    public void markSkipped(DocumentEntity doc, ProcessingStep step, String message, Map<String, Object> payload) {
        record(doc, step, ProcessingEventStatus.SKIPPED, message, payload);
    }

    public DocumentProcessingResponse buildResponse(DocumentEntity doc) {
        List<DocumentProcessingEventEntity> events = repository.findByDocIdOrderByCreatedAtAscIdAsc(doc.getDocId());
        Map<ProcessingStep, DocumentProcessingEventEntity> latestByStep = new EnumMap<>(ProcessingStep.class);
        for (DocumentProcessingEventEntity event : events) {
            latestByStep.put(event.getStep(), event);
        }

        boolean supported = isWordDocument(doc);
        List<ProcessingStepItem> steps = new ArrayList<>();
        for (ProcessingStep step : STEP_ORDER) {
            DocumentProcessingEventEntity event = latestByStep.get(step);
            if (event == null) {
                if (step == ProcessingStep.REVIEW && DocumentStatus.APPROVED.equals(doc.getStatus())) {
                    steps.add(new ProcessingStepItem(step.name(), ProcessingEventStatus.SUCCESS.name(), "管理员审核通过", null, null));
                } else if (!supported && (step == ProcessingStep.PARSE || step == ProcessingStep.CHUNK)) {
                    steps.add(new ProcessingStepItem(step.name(), ProcessingEventStatus.SKIPPED.name(), "当前仅支持 Word 切片可视化", null, null));
                } else {
                    steps.add(new ProcessingStepItem(step.name(), ProcessingEventStatus.PENDING.name(), null, null, null));
                }
            } else {
                steps.add(new ProcessingStepItem(
                        step.name(),
                        event.getStatus().name(),
                        event.getMessage(),
                        event.getStartedAt(),
                        event.getFinishedAt()
                ));
            }
        }

        ChunkStats chunkStats = null;
        List<ChunkPreviewItem> chunkPreview = List.of();
        String message = null;
        ProcessingStep currentStep = null;
        ProcessingEventStatus currentStatus = null;
        Instant updatedAt = doc.getCreatedAt();

        if (!events.isEmpty()) {
            DocumentProcessingEventEntity latest = events.get(events.size() - 1);
            currentStep = latest.getStep();
            currentStatus = latest.getStatus();
            message = latest.getMessage();
            updatedAt = latest.getCreatedAt();
        }

        DocumentProcessingEventEntity chunkEvent = latestByStep.get(ProcessingStep.CHUNK);
        if (chunkEvent != null && chunkEvent.getPayloadJson() != null) {
            Map<String, Object> payload = parsePayload(chunkEvent.getPayloadJson());
            chunkStats = buildChunkStats(payload.get("chunkStats"));
            chunkPreview = buildChunkPreview(payload.get("chunkPreview"));
        }

        if (!supported && (message == null || message.isBlank())) {
            message = "PDF 切片可视化暂未开放，当前仅展示处理状态占位。";
        }

        return new DocumentProcessingResponse(
                doc.getDocId(),
                normalizedFileType(doc),
                doc.getStatus().name(),
                supported,
                currentStep != null ? currentStep.name() : null,
                currentStatus != null ? currentStatus.name() : null,
                message,
                updatedAt,
                steps,
                chunkStats,
                chunkPreview,
                doc.getErrorMessage()
        );
    }

    public String normalizedFileType(DocumentEntity doc) {
        if (doc.getFileType() == null) {
            return "UNKNOWN";
        }
        String raw = doc.getFileType().toUpperCase(Locale.ROOT);
        if ("DOC".equals(raw) || "DOCX".equals(raw)) {
            return "WORD";
        }
        return raw;
    }

    public boolean isWordDocument(DocumentEntity doc) {
        String fileType = doc.getFileType();
        if (fileType == null) {
            return false;
        }
        String normalized = fileType.toUpperCase(Locale.ROOT);
        return "DOC".equals(normalized) || "DOCX".equals(normalized);
    }

    private void record(DocumentEntity doc, ProcessingStep step, ProcessingEventStatus status, String message, Map<String, Object> payload) {
        DocumentProcessingEventEntity entity = new DocumentProcessingEventEntity();
        entity.setDocId(doc.getDocId());
        entity.setFileType(normalizedFileType(doc));
        entity.setStep(step);
        entity.setStatus(status);
        entity.setMessage(message);
        entity.setCreatedAt(Instant.now());
        entity.setStartedAt(status == ProcessingEventStatus.PENDING ? null : entity.getCreatedAt());
        entity.setFinishedAt(status == ProcessingEventStatus.RUNNING || status == ProcessingEventStatus.PENDING ? null : entity.getCreatedAt());
        if (payload != null && !payload.isEmpty()) {
            try {
                entity.setPayloadJson(objectMapper.writeValueAsString(payload));
            } catch (Exception ignore) {
                entity.setPayloadJson(null);
            }
        }
        repository.save(entity);
    }

    private Map<String, Object> parsePayload(String payloadJson) {
        try {
            return objectMapper.readValue(payloadJson, new TypeReference<>() {});
        } catch (Exception ignore) {
            return Map.of();
        }
    }

    private ChunkStats buildChunkStats(Object raw) {
        if (!(raw instanceof Map<?, ?> stats)) {
            return null;
        }
        return new ChunkStats(
                asInteger(stats.get("totalChunks")),
                asInteger(stats.get("averageLength")),
                asInteger(stats.get("overlap")),
                asInteger(stats.get("chunkSize"))
        );
    }

    private List<ChunkPreviewItem> buildChunkPreview(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<ChunkPreviewItem> preview = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> entry)) {
                continue;
            }
            preview.add(new ChunkPreviewItem(
                    asString(entry.get("chunkId")),
                    asInteger(entry.get("chunkIndex")),
                    asInteger(entry.get("pageNum")),
                    asInteger(entry.get("length")),
                    asString(entry.get("title")),
                    asString(entry.get("content"))
            ));
        }
        return preview;
    }

    private Integer asInteger(Object value) {
        if (value instanceof Integer integer) {
            return integer;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return null;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
