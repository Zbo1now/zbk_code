package com.graduation.knowledgeback.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.api.dto.DocumentItem;
import com.graduation.knowledgeback.api.dto.DocumentPreviewResponse;
import com.graduation.knowledgeback.api.dto.DocumentUpdateRequest;
import com.graduation.knowledgeback.api.dto.PagedResponse;
import com.graduation.knowledgeback.api.dto.RebuildRequest;
import com.graduation.knowledgeback.api.dto.TaskStatusResponse;
import com.graduation.knowledgeback.api.dto.UploadResponse;
import com.graduation.knowledgeback.config.AppProperties;
import com.graduation.knowledgeback.domain.DocumentStatus;
import com.graduation.knowledgeback.domain.TaskType;
import com.graduation.knowledgeback.persistence.DocumentEntity;
import com.graduation.knowledgeback.persistence.DocumentRepository;
import com.graduation.knowledgeback.persistence.TaskEntity;
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
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/knowledge")
@Tag(name = "知识库 Knowledge", description = "知识库数据管理（单库模式）：上传导入、文档列表、删除、重建索引、异步任务查询。")
public class KnowledgeController {
    private final DocumentRepository documentRepository;
    private final TaskService taskService;
    private final IndexingService indexingService;
    private final com.graduation.knowledgeback.service.ParsingService parsingService;
    private final AppProperties appProperties;
    private final ElasticsearchClient elasticsearchClient;
    private final QdrantClient qdrantClient;
    private final ObjectMapper objectMapper;

    public KnowledgeController(DocumentRepository documentRepository,
                               TaskService taskService,
                               IndexingService indexingService,
                               com.graduation.knowledgeback.service.ParsingService parsingService,
                               AppProperties appProperties,
                               ElasticsearchClient elasticsearchClient,
                               QdrantClient qdrantClient,
                               ObjectMapper objectMapper) {
        this.documentRepository = documentRepository;
        this.taskService = taskService;
        this.indexingService = indexingService;
        this.parsingService = parsingService;
        this.appProperties = appProperties;
        this.elasticsearchClient = elasticsearchClient;
        this.qdrantClient = qdrantClient;
        this.objectMapper = objectMapper;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传文档（提交审核）", description = "上传文件后，状态默认为 PENDING_REVIEW，需管理员审核通过后才进入解析/索引流程。")
    public UploadResponse upload(@RequestPart("file") MultipartFile file,
                                 @Parameter(description = "可选：业务侧元数据（JSON 字符串）")
                                 @RequestPart(value = "metadata", required = false) String metadataJson) throws Exception {
        
        String uploadId = UUID.randomUUID().toString();
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            originalFilename = "uploaded_" + uploadId;
        }
        
        // 1. 计算文件信息
        long fileSize = file.getSize();
        String fileType = "";
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

        // 2. 保存文件到磁盘
        // 使用统一的目录结构
        var storedDir = Path.of("storage", "uploads", uploadId);
        Files.createDirectories(storedDir);
        var storedPath = storedDir.resolve(originalFilename);
        Files.copy(file.getInputStream(), storedPath, StandardCopyOption.REPLACE_EXISTING);

        // 3. 创建文档实体，状态为 PENDING_REVIEW
        // 使用 uploadId 作为初始 docId。
        // 对于可能包含多个逻辑文档的 .jsonl 文件，先将整个文件作为审核单元。
        DocumentEntity doc = new DocumentEntity();
        doc.setId(uploadId);
        doc.setOriginalFilename(originalFilename);
        doc.setStoredPath(storedPath.toString().replace("\\", "/"));
        doc.setMetadata(metadataJson);
        doc.setFileSize(fileSize);
        doc.setFileType(fileType);
        doc.setChecksum(checksum);
        doc.setUploadTime(java.time.LocalDateTime.now());
        boolean autoApprove = shouldAutoApprove(metadataJson);
        doc.setStatus(autoApprove ? DocumentStatus.APPROVED : DocumentStatus.PENDING_REVIEW);

        documentRepository.save(doc);

        if (autoApprove) {
            String taskId = startProcessing(doc);
            return new UploadResponse(taskId, uploadId, "APPROVED", "文件上传成功，自动审核通过并开始处理。");
        }

        return new UploadResponse(null, uploadId, "PENDING_REVIEW", "文件上传成功，等待管理员审核。");
    }

    @PostMapping("/documents/{docId}/review")
    @Operation(summary = "审核文档", description = "管理员审核文档。action=APPROVE: 开始解析/索引; action=REJECT: 拒绝并标记。")
    public ResponseEntity<?> reviewDocument(@PathVariable String docId, @RequestParam String action) {
        var docOpt = documentRepository.findById(docId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        DocumentEntity doc = docOpt.get();
        
        if ("APPROVE".equalsIgnoreCase(action)) {
            // 更新状态
            doc.setStatus(DocumentStatus.APPROVED);
            documentRepository.save(doc);
            String taskId = startProcessing(doc);
            return ResponseEntity.ok(Map.of("message", "文档审核通过，开始处理。", "taskId", taskId));

        } else if ("REJECT".equalsIgnoreCase(action)) {
            // 删除物理文件以节省空间
            try {
                Path fileToDelete = Path.of(doc.getStoredPath());
                Files.deleteIfExists(fileToDelete);
                // 可选：如果父目录为空则删除
                // Files.deleteIfExists(fileToDelete.getParent());
            } catch (Exception e) {
                // 打印警告但继续更新状态
                System.err.println("删除被拒绝文件失败: " + e.getMessage());
            }

            doc.setStatus(DocumentStatus.REJECTED);
            documentRepository.save(doc);
            return ResponseEntity.ok(Map.of("message", "文档已拒绝并删除文件。"));
        } else {
            return ResponseEntity.badRequest().body("无效操作。请使用 APPROVE 或 REJECT。");
        }
    }

    // 启动文档处理流程
    private String startProcessing(DocumentEntity doc) {
        var task = taskService.create(TaskType.INDEXING);
        task.setTargetId(doc.getId());
        taskService.save(task);

        taskService.runAsync(task.getTaskId(), () -> {
            try {
                processDocument(doc, task);
            } catch (Exception e) {
                var t = taskService.find(task.getTaskId()).orElseThrow();
                t.fail("处理失败: " + e.getMessage());
                taskService.save(t);
                doc.setStatus(DocumentStatus.FAILED);
                doc.setErrorMessage(e.getMessage());
                documentRepository.save(doc);
            }
        });

        return task.getTaskId();
    }

    // 判断是否自动审核通过
    private boolean shouldAutoApprove(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) return false;
        try {
            JsonNode root = objectMapper.readTree(metadataJson);
            String role = root.path("role").asText("");
            boolean isAdmin = root.path("isAdmin").asBoolean(false);
            String source = root.path("source").asText("");
            return isAdmin || "ADMIN".equalsIgnoreCase(role) || "admin".equalsIgnoreCase(role) || "admin_upload".equalsIgnoreCase(source);
        } catch (Exception e) {
            return false;
        }
    }

    // 审核通过后处理文档的辅助方法
    private void processDocument(DocumentEntity doc, TaskEntity task) {
         var t = taskService.find(task.getTaskId()).orElseThrow();
         t.start();
         taskService.save(t);
         
         try {
             Path storedPath = Path.of(doc.getStoredPath());
             boolean isJsonl = doc.getOriginalFilename().toLowerCase().endsWith(".jsonl");
             
             if (isJsonl) {
                 var metas = indexingService.indexJsonl(storedPath, defaultEmbedBatch());
                 
                 // 对于 JSONL，可能会有多个文档定义
                 for (var m : metas) {
                     String docId = m.docId();
                     if (docId == null || docId.isBlank()) continue;
                     
                     // 如果 jsonl 定义的文档与上传 ID 匹配，则更新状态
                     if (docId.equals(doc.getId())) {
                         doc.setStatus(DocumentStatus.INDEXED);
                         documentRepository.save(doc);
                     } else {
                         // 否则可根据需要创建/更新其他文档（批量导入场景）
                         var subDoc = documentRepository.findById(docId).orElse(new DocumentEntity());
                         subDoc.setId(docId);
                         subDoc.setStatus(DocumentStatus.INDEXED);
                         documentRepository.save(subDoc);
                     }
                 }
                 // 如果主文档未被标记为已索引，则补充标记
                 if (!DocumentStatus.INDEXED.equals(doc.getStatus())) {
                     doc.setStatus(DocumentStatus.INDEXED);
                     documentRepository.save(doc);
                 }
             } else {
                 // 1. 标记为解析中
                 doc.setStatus(DocumentStatus.PARSING);
                 documentRepository.save(doc);
                 
                 // 2. 解析内容
                 String content = parsingService.parse(storedPath);
                 
                 // 3. 分块
                 var chunks = parsingService.chunkDocument(doc.getId(), content, doc.getOriginalFilename(), doc.getStoredPath());
                 
                 // 4. 索引分块
                 var metas = indexingService.indexDocumentChunks(chunks, defaultEmbedBatch());
                 
                 // 5. 更新状态
                 doc.setStatus(DocumentStatus.INDEXED);
                 documentRepository.save(doc);
             }
             
             t.setTargetId(doc.getId());
             t.succeed();
             taskService.save(t);
         } catch (Exception e) {
             t.fail(e.getMessage());
             taskService.save(t);
            doc.setStatus(DocumentStatus.FAILED);
            doc.setErrorMessage(e.getMessage());
            documentRepository.save(doc);
         }
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
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int pageSize,
            @Parameter(description = "是否包含隐藏文档")
            @RequestParam(defaultValue = "false") boolean includeHidden
    ) {
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
    @Operation(summary = "更新文档信息", description = "更新文档展示名称、备注或隐藏状态。")
    public ResponseEntity<DocumentItem> updateDocument(
            @PathVariable String docId,
            @RequestBody DocumentUpdateRequest request
    ) {
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
    @Operation(summary = "文档预览", description = "返回文档原文的文本预览，用于前端阅读器展示。")
    public ResponseEntity<DocumentPreviewResponse> previewDocument(@PathVariable String docId) {
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
            content = content.substring(0, 20000) + "\n\n...（内容过长已截断）";
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

    @GetMapping("/documents/{docId}/download")
    @Operation(summary = "下载文档", description = "下载文档原始文件。")
    public ResponseEntity<FileSystemResource> downloadDocument(@PathVariable String docId) {
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
        return new UploadResponse(task.getTaskId(), docId, "processing", "删除任务已启动。");
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
        return new UploadResponse(task.getTaskId(), null, "processing", "重建任务已启动。");
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

    // 获取默认的向量化批处理大小
    private int defaultEmbedBatch() {
        var n = appProperties.indexing().embedBatchSize();
        if (n == null || n <= 0) return 64;
        return Math.min(n, 128);
    }
}
