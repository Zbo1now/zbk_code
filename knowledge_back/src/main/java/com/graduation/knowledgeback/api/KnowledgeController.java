package com.graduation.knowledgeback.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.api.dto.*;
import com.graduation.knowledgeback.client.ElasticsearchClient;
import com.graduation.knowledgeback.client.QdrantClient;
import com.graduation.knowledgeback.config.AppProperties;
import com.graduation.knowledgeback.domain.DocumentStatus;
import com.graduation.knowledgeback.domain.ProcessingStep;
import com.graduation.knowledgeback.domain.TaskType;
import com.graduation.knowledgeback.persistence.DocumentEntity;
import com.graduation.knowledgeback.persistence.DocumentRepository;
import com.graduation.knowledgeback.persistence.TaskEntity;
import com.graduation.knowledgeback.service.AuthContextHolder;
import com.graduation.knowledgeback.service.AuthenticatedUser;
import com.graduation.knowledgeback.service.DocumentProcessingTracker;
import com.graduation.knowledgeback.service.IndexingService;
import com.graduation.knowledgeback.service.PermissionService;
import com.graduation.knowledgeback.service.ParsingService;
import com.graduation.knowledgeback.service.TaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.core.io.FileSystemResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/knowledge")
@Tag(name = "Knowledge", description = "知识库文档管理、处理任务和切片配置接口")
public class KnowledgeController {
    private final DocumentRepository documentRepository;
    private final TaskService taskService;
    private final IndexingService indexingService;
    private final ParsingService parsingService;
    private final AppProperties appProperties;
    private final ElasticsearchClient elasticsearchClient;
    private final QdrantClient qdrantClient;
    private final ObjectMapper objectMapper;
    private final DocumentProcessingTracker documentProcessingTracker;
    private final PermissionService permissionService;

    public KnowledgeController(
            DocumentRepository documentRepository,
            TaskService taskService,
            IndexingService indexingService,
            ParsingService parsingService,
            AppProperties appProperties,
            ElasticsearchClient elasticsearchClient,
            QdrantClient qdrantClient,
            ObjectMapper objectMapper,
            DocumentProcessingTracker documentProcessingTracker,
            PermissionService permissionService
    ) {
        this.documentRepository = documentRepository;
        this.taskService = taskService;
        this.indexingService = indexingService;
        this.parsingService = parsingService;
        this.appProperties = appProperties;
        this.elasticsearchClient = elasticsearchClient;
        this.qdrantClient = qdrantClient;
        this.objectMapper = objectMapper;
        this.documentProcessingTracker = documentProcessingTracker;
        this.permissionService = permissionService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传文档", description = "上传后进入审核或自动处理流程。")
    public UploadResponse upload(
            @RequestPart("file") MultipartFile file,
            @Parameter(description = "可选 JSON 元数据")
            @RequestPart(value = "metadata", required = false) String metadataJson
    ) throws Exception {
        permissionService.requirePermission("kb.upload");
        AuthenticatedUser currentUser = AuthContextHolder.require();
        String uploadId = UUID.randomUUID().toString();
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            originalFilename = "uploaded_" + uploadId;
        }

        long fileSize = file.getSize();
        String fileType;
        int dotIndex = originalFilename.lastIndexOf(".");
        if (dotIndex >= 0) {
            fileType = originalFilename.substring(dotIndex + 1).toUpperCase();
        } else {
            fileType = "UNKNOWN";
        }

        String checksum;
        try (var is = file.getInputStream()) {
            checksum = org.springframework.util.DigestUtils.md5DigestAsHex(is);
        }

        var storedDir = Path.of("storage", "uploads", uploadId);
        Files.createDirectories(storedDir);
        var storedPath = storedDir.resolve(originalFilename);
        Files.copy(file.getInputStream(), storedPath, StandardCopyOption.REPLACE_EXISTING);

        DocumentEntity doc = new DocumentEntity();
        doc.setId(uploadId);
        doc.setOriginalFilename(originalFilename);
        doc.setStoredPath(storedPath.toString().replace("\\", "/"));
        doc.setMetadata(metadataJson);
        doc.setFileSize(fileSize);
        doc.setFileType(fileType);
        doc.setChecksum(checksum);
        doc.setUploadTime(java.time.LocalDateTime.now());
        doc.setUploadedBy(AuthContextHolder.require().userId());

        boolean autoApprove = shouldAutoApprove(currentUser);
        doc.setStatus(autoApprove ? DocumentStatus.APPROVED : DocumentStatus.PENDING_REVIEW);
        documentRepository.save(doc);

        documentProcessingTracker.recordUpload(doc, autoApprove);
        if (autoApprove) {
            documentProcessingTracker.recordReview(doc, true);
            String taskId = startProcessing(doc);
            return new UploadResponse(taskId, uploadId, "APPROVED", "文件上传成功，已自动审核并开始处理。");
        }

        return new UploadResponse(null, uploadId, "PENDING_REVIEW", "文件上传成功，等待管理员审核。");
    }

    @PostMapping("/documents/{docId}/review")
    @Operation(summary = "审核文档", description = "管理员审核通过后开始处理，拒绝则保留状态记录。")
    public ResponseEntity<?> reviewDocument(@PathVariable String docId, @RequestParam String action) {
        permissionService.requirePermission("doc.review");
        var docOpt = documentRepository.findById(docId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        DocumentEntity doc = docOpt.get();
        if ("APPROVE".equalsIgnoreCase(action)) {
            doc.setStatus(DocumentStatus.APPROVED);
            doc.setReviewedBy(AuthContextHolder.require().userId());
            doc.setReviewedAt(java.time.Instant.now());
            documentRepository.save(doc);
            documentProcessingTracker.recordReview(doc, true);
            String taskId = startProcessing(doc);
            return ResponseEntity.ok(Map.of("message", "文档审核通过，开始处理。", "taskId", taskId));
        }
        if ("REJECT".equalsIgnoreCase(action)) {
            try {
                Path fileToDelete = Path.of(doc.getStoredPath());
                Files.deleteIfExists(fileToDelete);
            } catch (Exception e) {
                System.err.println("删除被拒绝的文件失败: " + e.getMessage());
            }

            doc.setStatus(DocumentStatus.REJECTED);
            doc.setReviewedBy(AuthContextHolder.require().userId());
            doc.setReviewedAt(java.time.Instant.now());
            documentRepository.save(doc);
            documentProcessingTracker.recordReview(doc, false);
            return ResponseEntity.ok(Map.of("message", "文档已拒绝并删除原文件。"));
        }
        return ResponseEntity.badRequest().body("无效操作，请使用 APPROVE 或 REJECT。");
    }

    @GetMapping("/chunk-settings")
    @Operation(summary = "获取切片参数", description = "返回当前运行时的切片目标长度和重叠长度。")
    public ChunkSettingsResponse getChunkSettings() {
        permissionService.requirePermission("system.manage");
        return new ChunkSettingsResponse(
                parsingService.getChunkSize(),
                parsingService.getChunkOverlap(),
                parsingService.getDefaultChunkSize(),
                parsingService.getDefaultChunkOverlap()
        );
    }

    @PatchMapping("/chunk-settings")
    @Operation(summary = "更新切片参数", description = "动态调整后续文档处理使用的切片目标长度和重叠长度。")
    public ChunkSettingsResponse updateChunkSettings(@RequestBody ChunkSettingsRequest request) {
        permissionService.requirePermission("system.manage");
        int chunkSize = request.chunkSize() != null ? request.chunkSize() : parsingService.getChunkSize();
        int overlap = request.overlap() != null ? request.overlap() : parsingService.getChunkOverlap();
        parsingService.updateChunkSettings(chunkSize, overlap);
        return getChunkSettings();
    }

    private String startProcessing(DocumentEntity doc) {
        var task = taskService.create(TaskType.INDEXING);
        task.setTargetId(doc.getId());
        taskService.save(task);

        taskService.runAsync(task.getTaskId(), () -> {
            try {
                processDocument(doc, task);
            } catch (Exception e) {
                var currentTask = taskService.find(task.getTaskId()).orElseThrow();
                currentTask.fail("处理失败: " + e.getMessage());
                taskService.save(currentTask);
                doc.setStatus(DocumentStatus.FAILED);
                doc.setErrorMessage(e.getMessage());
                documentRepository.save(doc);
                documentProcessingTracker.markFailed(doc, ProcessingStep.COMPLETE, "处理失败: " + e.getMessage());
            }
        });

        return task.getTaskId();
    }

    private boolean shouldAutoApprove(AuthenticatedUser currentUser) {
        return currentUser != null && currentUser.isAdmin();
    }

    private void processDocument(DocumentEntity doc, TaskEntity task) {
        var currentTask = taskService.find(task.getTaskId()).orElseThrow();
        currentTask.start();
        taskService.save(currentTask);

        try {
            Path storedPath = Path.of(doc.getStoredPath());
            boolean isJsonl = doc.getOriginalFilename().toLowerCase().endsWith(".jsonl");
            boolean isWord = documentProcessingTracker.isWordDocument(doc);

            if (isJsonl) {
                documentProcessingTracker.markSkipped(doc, ProcessingStep.PARSE, "JSONL 导入跳过原文解析", Map.of("supported", false));
                documentProcessingTracker.markSkipped(doc, ProcessingStep.CHUNK, "JSONL 导入跳过切片预览", Map.of("supported", false));
                documentProcessingTracker.markRunning(doc, ProcessingStep.EMBED, "开始处理 JSONL 向量化");
                var metas = indexingService.indexJsonl(storedPath, defaultEmbedBatch());
                documentProcessingTracker.markSuccess(doc, ProcessingStep.EMBED, "JSONL 向量化完成", Map.of("batchSize", defaultEmbedBatch()));
                documentProcessingTracker.markSuccess(doc, ProcessingStep.INDEX_QDRANT, "Qdrant 写入完成", Map.of("documentCount", metas.size()));
                documentProcessingTracker.markSuccess(doc, ProcessingStep.INDEX_ES, "Elasticsearch 写入完成", Map.of("documentCount", metas.size()));

                for (var meta : metas) {
                    String docId = meta.docId();
                    if (docId == null || docId.isBlank()) {
                        continue;
                    }
                    if (docId.equals(doc.getId())) {
                        doc.setStatus(DocumentStatus.INDEXED);
                        documentRepository.save(doc);
                    } else {
                        var subDoc = documentRepository.findById(docId).orElse(new DocumentEntity());
                        subDoc.setId(docId);
                        subDoc.setStatus(DocumentStatus.INDEXED);
                        documentRepository.save(subDoc);
                    }
                }

                if (!DocumentStatus.INDEXED.equals(doc.getStatus())) {
                    doc.setStatus(DocumentStatus.INDEXED);
                    documentRepository.save(doc);
                }
            } else {
                doc.setStatus(DocumentStatus.PARSING);
                documentRepository.save(doc);

                documentProcessingTracker.markRunning(doc, ProcessingStep.PARSE, "开始解析文档内容");
                String content = parsingService.parse(storedPath);
                documentProcessingTracker.markSuccess(
                        doc,
                        ProcessingStep.PARSE,
                        isWord ? "Word 文本解析完成" : "文档文本解析完成",
                        Map.of("contentLength", content != null ? content.length() : 0, "supported", isWord)
                );

                ChunkSettingSnapshot chunkSettingSnapshot = resolveChunkSettings(doc);
                List<JsonNode> chunks = parsingService.chunkDocument(
                        doc.getId(),
                        content,
                        doc.getOriginalFilename(),
                        doc.getStoredPath(),
                        chunkSettingSnapshot.chunkSize(),
                        chunkSettingSnapshot.overlap()
                );
                if (isWord) {
                    documentProcessingTracker.markRunning(doc, ProcessingStep.CHUNK, "开始生成切片");
                    documentProcessingTracker.markSuccess(doc, ProcessingStep.CHUNK, "Word 切片生成完成", buildChunkPayload(chunks, chunkSettingSnapshot.chunkSize(), chunkSettingSnapshot.overlap()));
                } else {
                    documentProcessingTracker.markSkipped(
                            doc,
                            ProcessingStep.CHUNK,
                            "PDF 切片可视化暂未开放，当前仅保留状态占位",
                            Map.of("supported", false)
                    );
                }

                documentProcessingTracker.markRunning(doc, ProcessingStep.EMBED, "开始生成向量并写入索引");
                var metas = indexingService.indexDocumentChunks(chunks, defaultEmbedBatch());
                documentProcessingTracker.markSuccess(doc, ProcessingStep.EMBED, "向量生成完成", Map.of("chunkCount", chunks.size()));
                documentProcessingTracker.markSuccess(doc, ProcessingStep.INDEX_QDRANT, "Qdrant 写入完成", Map.of("documentCount", metas.size()));
                documentProcessingTracker.markSuccess(doc, ProcessingStep.INDEX_ES, "Elasticsearch 写入完成", Map.of("documentCount", metas.size()));

                doc.setStatus(DocumentStatus.INDEXED);
                documentRepository.save(doc);
            }

            currentTask.setTargetId(doc.getId());
            currentTask.succeed();
            taskService.save(currentTask);
            documentProcessingTracker.markSuccess(doc, ProcessingStep.COMPLETE, "文档处理完成", Map.of("status", doc.getStatus().name()));
        } catch (Exception e) {
            currentTask.fail(e.getMessage());
            taskService.save(currentTask);
            doc.setStatus(DocumentStatus.FAILED);
            doc.setErrorMessage(e.getMessage());
            documentRepository.save(doc);
            documentProcessingTracker.markFailed(doc, ProcessingStep.COMPLETE, "文档处理失败: " + e.getMessage());
        }
    }

    @GetMapping("/documents")
    @Operation(summary = "文档列表", description = "分页查询文档元数据。")
    public PagedResponse<DocumentItem> listDocuments(
            @Parameter(description = "页码，从 1 开始")
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @Parameter(description = "每页条数")
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int pageSize,
            @Parameter(description = "是否包含隐藏文档")
            @RequestParam(defaultValue = "false") boolean includeHidden
    ) {
        permissionService.requirePermission("kb.view");
        var pageable = PageRequest.of(page - 1, pageSize);
        var result = includeHidden ? documentRepository.findAll(pageable) : documentRepository.findByHiddenFalse(pageable);
        var items = result.getContent().stream()
                .map(d -> new DocumentItem(
                        d.getDocId(),
                        d.getOriginalFilename(),
                        d.getDisplayName(),
                        d.getDescription(),
                        d.getStoredPath(),
                        d.getStatus(),
                        d.getCreatedAt(),
                        d.isHidden(),
                        d.getFileSize(),
                        d.getFileType(),
                        d.getChecksum(),
                        d.getErrorMessage()
                ))
                .toList();
        return new PagedResponse<>(page, pageSize, result.getTotalElements(), items);
    }

    @PatchMapping("/documents/{docId}")
    @Operation(summary = "更新文档信息", description = "更新展示名、备注或隐藏状态。")
    public ResponseEntity<DocumentItem> updateDocument(@PathVariable String docId, @RequestBody DocumentUpdateRequest request) {
        permissionService.requirePermission("kb.manage");
        var docOpt = documentRepository.findById(docId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        DocumentEntity doc = docOpt.get();
        if (request.displayName() != null) {
            doc.setDisplayName(request.displayName());
        }
        if (request.description() != null) {
            doc.setDescription(request.description());
        }
        if (request.hidden() != null) {
            doc.setHidden(request.hidden());
        }
        documentRepository.save(doc);

        return ResponseEntity.ok(new DocumentItem(
                doc.getDocId(),
                doc.getOriginalFilename(),
                doc.getDisplayName(),
                doc.getDescription(),
                doc.getStoredPath(),
                doc.getStatus(),
                doc.getCreatedAt(),
                doc.isHidden(),
                doc.getFileSize(),
                doc.getFileType(),
                doc.getChecksum(),
                doc.getErrorMessage()
        ));
    }

    @GetMapping("/documents/{docId}/preview")
    @Operation(summary = "文档预览", description = "返回原文文本预览。")
    public ResponseEntity<DocumentPreviewResponse> previewDocument(@PathVariable String docId) {
        permissionService.requirePermission("kb.view");
        var docOpt = documentRepository.findById(docId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        DocumentEntity doc = docOpt.get();
        String content = "";
        String errorMessage = null;
        try {
            Path storedPath = Path.of(doc.getStoredPath());
            if (!Files.exists(storedPath)) {
                errorMessage = "原始文件不存在";
            } else if (doc.getOriginalFilename().toLowerCase().endsWith(".jsonl")) {
                var lines = Files.readAllLines(storedPath, StandardCharsets.UTF_8);
                content = String.join("\n", lines);
            } else {
                content = parsingService.parse(storedPath);
            }
        } catch (Exception e) {
            errorMessage = e.getMessage();
        }

        if (content != null && content.length() > 20000) {
            content = content.substring(0, 20000) + "\n\n...(内容过长，已截断)";
        }

        return ResponseEntity.ok(new DocumentPreviewResponse(
                doc.getDocId(),
                doc.getOriginalFilename(),
                doc.getDisplayName(),
                doc.getDescription(),
                doc.getFileType(),
                doc.getStatus().name(),
                doc.getFileSize(),
                doc.getCreatedAt(),
                doc.isHidden(),
                doc.getChecksum(),
                content,
                errorMessage
        ));
    }

    @GetMapping("/documents/{docId}/processing")
    @Operation(summary = "文档处理详情", description = "返回处理时间线和处理结果摘要。")
    public ResponseEntity<DocumentProcessingResponse> processingDetail(@PathVariable String docId) {
        permissionService.requirePermission("kb.view");
        var docOpt = documentRepository.findById(docId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(documentProcessingTracker.buildResponse(docOpt.get()));
    }

    @GetMapping("/documents/{docId}/chunk-preview")
    @Operation(summary = "切片预览", description = "基于当前或指定切片参数重新计算 Word 文档切片预览。")
    public ResponseEntity<ChunkPreviewResponse> chunkPreview(
            @PathVariable String docId,
            @RequestParam(required = false) Integer chunkSize,
            @RequestParam(required = false) Integer overlap
    ) {
        permissionService.requirePermission("kb.view");
        var docOpt = documentRepository.findById(docId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        DocumentEntity doc = docOpt.get();
        if (!documentProcessingTracker.isWordDocument(doc)) {
            return ResponseEntity.ok(new ChunkPreviewResponse(
                    docId,
                    false,
                    "当前仅支持 Word 文档切片预览，PDF 先展示状态占位。",
                    new ChunkStats(0, null, overlap, chunkSize),
                    List.of()
            ));
        }

        int resolvedChunkSize = chunkSize != null ? chunkSize : parsingService.getChunkSize();
        int resolvedOverlap = overlap != null ? overlap : parsingService.getChunkOverlap();

        try {
            String content = parsingService.parse(Path.of(doc.getStoredPath()));
            List<JsonNode> chunks = parsingService.chunkDocument(
                    doc.getId(),
                    content,
                    doc.getOriginalFilename(),
                    doc.getStoredPath(),
                    resolvedChunkSize,
                    resolvedOverlap
            );
            return ResponseEntity.ok(new ChunkPreviewResponse(
                    docId,
                    true,
                    "已根据当前参数重新生成切片预览。",
                    buildChunkStats(chunks, resolvedChunkSize, resolvedOverlap),
                    chunks.stream().map(this::toChunkPreviewItem).toList()
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(new ChunkPreviewResponse(
                    docId,
                    true,
                    "切片预览生成失败: " + e.getMessage(),
                    new ChunkStats(0, null, resolvedOverlap, resolvedChunkSize),
                    List.of()
            ));
        }
    }

    @GetMapping("/documents/{docId}/download")
    @Operation(summary = "下载文档", description = "下载原始文件。")
    public ResponseEntity<FileSystemResource> downloadDocument(@PathVariable String docId) {
        permissionService.requirePermission("kb.view");
        var docOpt = documentRepository.findById(docId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        DocumentEntity doc = docOpt.get();
        Path storedPath = Path.of(doc.getStoredPath());
        if (!Files.exists(storedPath)) {
            return ResponseEntity.notFound().build();
        }

        FileSystemResource resource = new FileSystemResource(storedPath.toFile());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getOriginalFilename() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @DeleteMapping("/documents/{docId}")
    @Operation(summary = "删除文档", description = "异步删除 Elasticsearch、Qdrant 和本地记录。")
    public UploadResponse deleteDocument(@PathVariable String docId) {
        permissionService.requirePermission("kb.manage");
        var task = taskService.create(TaskType.DELETE_DOCUMENT);
        taskService.runAsync(task.getTaskId(), () -> {
            var currentTask = taskService.find(task.getTaskId()).orElseThrow();
            currentTask.start();
            taskService.save(currentTask);
            try {
                currentTask.setProgress(30);
                taskService.save(currentTask);

                elasticsearchClient.deleteByDocId(docId);
                qdrantClient.deleteByDocId(docId);
                currentTask.setProgress(60);
                taskService.save(currentTask);

                documentRepository.deleteById(Objects.requireNonNull(docId, "docId"));
                currentTask.succeed();
                taskService.save(currentTask);
            } catch (Exception e) {
                currentTask.fail(e.getMessage());
                taskService.save(currentTask);
            }
        });
        return new UploadResponse(task.getTaskId(), docId, "processing", "删除任务已启动。");
    }

    @PostMapping("/rebuild")
    @Operation(summary = "重建索引", description = "从配置的 JSONL 重新导入数据。")
    public UploadResponse rebuild(@RequestBody(required = false) RebuildRequest req) {
        permissionService.requirePermission("kb.manage");
        var task = taskService.create(TaskType.REBUILD);
        taskService.runAsync(task.getTaskId(), () -> {
            var currentTask = taskService.find(task.getTaskId()).orElseThrow();
            currentTask.start();
            taskService.save(currentTask);
            try {
                var path = Path.of(appProperties.indexing().sourceJsonlPath()).normalize();
                boolean rebuildEs = req == null || req.rebuildEs() == null || req.rebuildEs();
                boolean rebuildQdrant = req == null || req.rebuildQdrant() == null || req.rebuildQdrant();

                var metas = indexingService.rebuildFromJsonl(path, defaultEmbedBatch(), rebuildEs, rebuildQdrant);
                for (var meta : metas) {
                    String docId = meta.docId();
                    if (docId == null || docId.isBlank()) {
                        continue;
                    }
                    var doc = documentRepository.findById(docId)
                            .orElseGet(() -> new DocumentEntity(
                                    docId,
                                    meta.title() != null ? meta.title() : (meta.source() != null ? meta.source() : "unknown"),
                                    meta.source() != null ? meta.source() : path.toString().replace("\\", "/"),
                                    null
                            ));
                    doc.updateBasicInfo(
                            meta.title() != null ? meta.title() : doc.getOriginalFilename(),
                            meta.source() != null ? meta.source() : doc.getStoredPath(),
                            doc.getMetadataJson()
                    );
                    doc.setStatus(DocumentStatus.INDEXED);
                    documentRepository.save(doc);
                }
                currentTask.succeed();
                taskService.save(currentTask);
            } catch (Exception e) {
                currentTask.fail(e.getMessage());
                taskService.save(currentTask);
            }
        });
        return new UploadResponse(task.getTaskId(), null, "processing", "重建任务已启动。");
    }

    @GetMapping("/tasks/{taskId}")
    @Operation(summary = "查询任务状态", description = "返回异步任务的进度和状态。")
    public TaskStatusResponse getTask(@PathVariable String taskId) {
        permissionService.requireAuthenticated();
        var task = taskService.find(taskId).orElseThrow();
        return new TaskStatusResponse(
                task.getTaskId(),
                task.getType(),
                task.getStatus(),
                task.getProgress(),
                task.getErrorMessage(),
                task.getCreatedAt(),
                task.getStartedAt(),
                task.getFinishedAt()
        );
    }

    private int defaultEmbedBatch() {
        var batch = appProperties.indexing().embedBatchSize();
        if (batch == null || batch <= 0) {
            return 64;
        }
        return Math.min(batch, 128);
    }

    private Map<String, Object> buildChunkPayload(List<JsonNode> chunks, int chunkSize, int overlap) {
        ChunkStats stats = buildChunkStats(chunks, chunkSize, overlap);
        return Map.of(
                "chunkStats", Map.of(
                        "totalChunks", stats.totalChunks(),
                        "averageLength", stats.averageLength(),
                        "overlap", stats.overlap(),
                        "chunkSize", stats.chunkSize()
                ),
                "chunkPreview", chunks.stream().map(this::toChunkPreviewMap).toList()
        );
    }

    private ChunkSettingSnapshot resolveChunkSettings(DocumentEntity doc) {
        int chunkSize = parsingService.getChunkSize();
        int overlap = parsingService.getChunkOverlap();
        String metadataJson = doc.getMetadataJson();
        if (metadataJson == null || metadataJson.isBlank()) {
            return new ChunkSettingSnapshot(chunkSize, overlap);
        }

        try {
            JsonNode root = objectMapper.readTree(metadataJson);
            JsonNode chunkSettingsNode = root.path("chunkSettings");
            if (chunkSettingsNode.has("chunkSize") && chunkSettingsNode.get("chunkSize").canConvertToInt()) {
                chunkSize = chunkSettingsNode.get("chunkSize").asInt();
            }
            if (chunkSettingsNode.has("overlap") && chunkSettingsNode.get("overlap").canConvertToInt()) {
                overlap = chunkSettingsNode.get("overlap").asInt();
            }
        } catch (Exception ignored) {
            return new ChunkSettingSnapshot(parsingService.getChunkSize(), parsingService.getChunkOverlap());
        }

        return new ChunkSettingSnapshot(chunkSize, overlap);
    }

    private ChunkStats buildChunkStats(List<JsonNode> chunks, int chunkSize, int overlap) {
        int totalLength = chunks.stream().mapToInt(chunk -> chunk.path("content").asText("").length()).sum();
        int averageLength = chunks.isEmpty() ? 0 : totalLength / chunks.size();
        return new ChunkStats(chunks.size(), averageLength, overlap, chunkSize);
    }

    private ChunkPreviewItem toChunkPreviewItem(JsonNode chunk) {
        Integer pageNum = chunk.has("page_num") && chunk.get("page_num").canConvertToInt() ? chunk.get("page_num").asInt() : null;
        return new ChunkPreviewItem(
                chunk.path("chunk_id").asText(),
                chunk.path("chunk_index").asInt(),
                pageNum,
                chunk.path("content").asText("").length(),
                chunk.path("title").asText(""),
                chunk.path("content").asText("")
        );
    }

    private Map<String, Object> toChunkPreviewMap(JsonNode chunk) {
        ChunkPreviewItem item = toChunkPreviewItem(chunk);
        return Map.of(
                "chunkId", item.chunkId(),
                "chunkIndex", item.chunkIndex(),
                "pageNum", item.pageNum() == null ? "" : item.pageNum(),
                "length", item.length(),
                "title", item.title() == null ? "" : item.title(),
                "content", item.content()
        );
    }

    private record ChunkSettingSnapshot(int chunkSize, int overlap) {
    }
}
