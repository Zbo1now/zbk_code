package com.graduation.knowledgeback.api;

import com.graduation.knowledgeback.api.dto.DocumentItem;
import com.graduation.knowledgeback.api.dto.PagedResponse;
import com.graduation.knowledgeback.api.dto.RebuildRequest;
import com.graduation.knowledgeback.api.dto.TaskStatusResponse;
import com.graduation.knowledgeback.api.dto.UploadResponse;
import com.graduation.knowledgeback.config.AppProperties;
import com.graduation.knowledgeback.domain.DocumentStatus;
import com.graduation.knowledgeback.domain.TaskType;
import com.graduation.knowledgeback.persistence.DocumentEntity;
import com.graduation.knowledgeback.persistence.DocumentRepository;
import com.graduation.knowledgeback.client.ElasticsearchClient;
import com.graduation.knowledgeback.client.QdrantClient;
import com.graduation.knowledgeback.service.IndexingService;
import com.graduation.knowledgeback.service.TaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/knowledge")
@Tag(name = "知识库 Knowledge", description = "知识库数据管理（单库模式）：上传导入、文档列表、删除、重建索引、异步任务查询。")
public class KnowledgeController {
    private final DocumentRepository documentRepository;
    private final TaskService taskService;
    private final IndexingService indexingService;
    private final AppProperties appProperties;
    private final ElasticsearchClient elasticsearchClient;
    private final QdrantClient qdrantClient;

    public KnowledgeController(DocumentRepository documentRepository,
                               TaskService taskService,
                               IndexingService indexingService,
                               AppProperties appProperties,
                               ElasticsearchClient elasticsearchClient,
                               QdrantClient qdrantClient) {
        this.documentRepository = documentRepository;
        this.taskService = taskService;
        this.indexingService = indexingService;
        this.appProperties = appProperties;
        this.elasticsearchClient = elasticsearchClient;
        this.qdrantClient = qdrantClient;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @Operation(
            summary = "上传并导入知识库（异步）",
            description = "当前仅支持上传已切片的 .jsonl 文件进行入库（包含 doc_id/chunk_id/content 等字段）。接口会立即返回 taskId，可用 /tasks/{taskId} 查询进度与结果。"
        )
    public UploadResponse upload(@RequestPart("file") MultipartFile file,
                     @Parameter(description = "可选：业务侧元数据（JSON 字符串），会存入 documents 表用于追踪")
                     @RequestPart(value = "metadata", required = false) String metadataJson) throws Exception {
        var uploadId = UUID.randomUUID().toString();
        String originalFilename = file.getOriginalFilename();
        String original = (originalFilename == null || originalFilename.isBlank()) ? "uploaded.bin" : originalFilename;
        var storedDir = Path.of("storage", "uploads", uploadId);
        Files.createDirectories(storedDir);
        var storedPath = storedDir.resolve(original);
        Files.copy(file.getInputStream(), storedPath, StandardCopyOption.REPLACE_EXISTING);

        var task = taskService.create(TaskType.UPLOAD);
        taskService.runAsync(task.getTaskId(), () -> {
            var t = taskService.find(task.getTaskId()).orElseThrow();
            t.start();
            taskService.save(t);
            try {
                if (original.toLowerCase().endsWith(".jsonl")) {
                    var metas = indexingService.indexJsonl(storedPath, defaultEmbedBatch());
                    // Upsert logical documents by payload doc_id
                    for (var m : metas) {
                    String docId = m.docId();
                    if (docId == null || docId.isBlank()) continue;
                    var doc = documentRepository.findById(docId)
                                .orElseGet(() -> new DocumentEntity(
                            docId,
                                        m.title() != null ? m.title() : (m.source() != null ? m.source() : "unknown"),
                                        m.source() != null ? m.source() : storedPath.toString().replace("\\", "/"),
                                        metadataJson
                                ));
                        doc.updateBasicInfo(
                                m.title() != null ? m.title() : doc.getOriginalFilename(),
                                m.source() != null ? m.source() : doc.getStoredPath(),
                                metadataJson
                        );
                        doc.setStatus(DocumentStatus.INDEXED);
                        documentRepository.save(doc);
                    }
                    t.succeed();
                    taskService.save(t);
                } else {
                    var msg = "当前仅支持上传已切片的 .jsonl（包含 chunk_id/content 等字段）进行入库。PDF/Excel 解析可后续扩展。";
                    t.fail(msg);
                    taskService.save(t);
                }
            } catch (Exception e) {
                t.fail(e.getMessage());
                taskService.save(t);
            }
        });

        // docId 可能是多个（JSONL 批量导入），这里返回 null，前端可通过 documents 列表查看。
        return new UploadResponse(task.getTaskId(), null, "processing", "File uploaded, processing started.");
    }

    @GetMapping("/documents")
        @Operation(
            summary = "文档列表（分页）",
            description = "查询本地 documents 表中的逻辑文档列表。docId 与索引 payload 的 doc_id 对齐。"
        )
    public PagedResponse<DocumentItem> listDocuments(
            @Parameter(description = "页码（从 1 开始）")
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @Parameter(description = "每页条数（1~100）")
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int pageSize
    ) {
        var pageable = PageRequest.of(page - 1, pageSize);
        var result = documentRepository.findAll(pageable);
        var items = result.getContent().stream()
                .map(d -> new DocumentItem(d.getDocId(), d.getOriginalFilename(), d.getStoredPath(), d.getStatus(), d.getCreatedAt(), d.getErrorMessage()))
                .toList();
        return new PagedResponse<>(page, pageSize, result.getTotalElements(), items);
    }

    @DeleteMapping("/documents/{docId}")
        @Operation(
            summary = "删除文档（异步）",
            description = "按 docId（即 payload.doc_id）同步删除 Elasticsearch 与 Qdrant 中的相关数据，并删除本地 documents 记录；返回 taskId 查询任务状态。"
        )
        public UploadResponse deleteDocument(
            @Parameter(description = "逻辑文档 ID（等同于索引 payload 的 doc_id）")
            @PathVariable String docId
        ) {
        var task = taskService.create(TaskType.DELETE_DOCUMENT);
        taskService.runAsync(task.getTaskId(), () -> {
            var t = taskService.find(task.getTaskId()).orElseThrow();
            t.start();
            taskService.save(t);
            try {
                t.setProgress(30);
                taskService.save(t);

                // docId 在本系统中等同于 payload 的 doc_id
                elasticsearchClient.deleteByDocId(docId);
                qdrantClient.deleteByDocId(docId);
                t.setProgress(60);
                taskService.save(t);

                documentRepository.deleteById(Objects.requireNonNull(docId, "docId"));
                t.succeed();
                taskService.save(t);
            } catch (Exception e) {
                t.fail(e.getMessage());
                taskService.save(t);
            }
        });
        return new UploadResponse(task.getTaskId(), docId, "processing", "Delete task started.");
    }

    @PostMapping("/rebuild")
        @Operation(
            summary = "重建索引（异步）",
            description = "从配置的 sourceJsonlPath 重新导入数据，可选重建 ES/Qdrant。返回 taskId 查询进度与结果。"
        )
    public UploadResponse rebuild(@RequestBody(required = false) RebuildRequest req) {
        var task = taskService.create(TaskType.REBUILD);
        taskService.runAsync(task.getTaskId(), () -> {
            var t = taskService.find(task.getTaskId()).orElseThrow();
            t.start();
            taskService.save(t);
            try {
                var path = Path.of(appProperties.indexing().sourceJsonlPath()).normalize();
                boolean rebuildEs = req == null || req.rebuildEs() == null || req.rebuildEs();
                boolean rebuildQdrant = req == null || req.rebuildQdrant() == null || req.rebuildQdrant();
                // reEmbed 暂不区分：当前后端入库默认都会向量化并写入 Qdrant

                var metas = indexingService.rebuildFromJsonl(path, defaultEmbedBatch(), rebuildEs, rebuildQdrant);
                // rebuild 后同步刷新 documents 表（以 JSONL 内的 doc_id 为准）
                for (var m : metas) {
                    String docId = m.docId();
                    if (docId == null || docId.isBlank()) continue;
                    var doc = documentRepository.findById(docId)
                            .orElseGet(() -> new DocumentEntity(
                            docId,
                                    m.title() != null ? m.title() : (m.source() != null ? m.source() : "unknown"),
                                    m.source() != null ? m.source() : path.toString().replace("\\", "/"),
                                    null
                            ));
                    doc.updateBasicInfo(
                            m.title() != null ? m.title() : doc.getOriginalFilename(),
                            m.source() != null ? m.source() : doc.getStoredPath(),
                            doc.getMetadataJson()
                    );
                    doc.setStatus(DocumentStatus.INDEXED);
                    documentRepository.save(doc);
                }
                t.succeed();
                taskService.save(t);
            } catch (Exception e) {
                t.fail(e.getMessage());
                taskService.save(t);
            }
        });
        return new UploadResponse(task.getTaskId(), null, "processing", "Rebuild task started.");
    }

    @GetMapping("/tasks/{taskId}")
        @Operation(summary = "查询任务状态", description = "查询上传/删除/重建等异步任务的状态、进度、错误信息与时间戳。")
        public TaskStatusResponse getTask(
            @Parameter(description = "任务 ID")
            @PathVariable String taskId
        ) {
        var t = taskService.find(taskId).orElseThrow();
        return new TaskStatusResponse(
                t.getTaskId(),
                t.getType(),
                t.getStatus(),
                t.getProgress(),
                t.getErrorMessage(),
                t.getCreatedAt(),
                t.getStartedAt(),
                t.getFinishedAt()
        );
    }

    private int defaultEmbedBatch() {
        var n = appProperties.indexing().embedBatchSize();
        if (n == null || n <= 0) return 64;
        return Math.min(n, 128);
    }
}
