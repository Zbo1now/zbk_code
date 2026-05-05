package com.graduation.knowledgeback.api;

import com.graduation.knowledgeback.api.dto.PipelineSearchRequest;
import com.graduation.knowledgeback.api.dto.PipelineSearchResponse;
import com.graduation.knowledgeback.api.dto.SingleSearchRequest;
import com.graduation.knowledgeback.api.dto.SingleSearchResponse;
import com.graduation.knowledgeback.persistence.SearchLogEntity;
import com.graduation.knowledgeback.persistence.SearchLogRepository;
import com.graduation.knowledgeback.service.PermissionService;
import com.graduation.knowledgeback.service.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
@Tag(name = "检索 Search", description = "对单知识库进行混合检索：ES 关键词召回 + Qdrant 向量召回，使用 RRF 融合；可选调用模型服务进行 rerank 精排。")
public class SearchController {
    private final SearchService searchService;
    private final SearchLogRepository searchLogRepository;
    private final PermissionService permissionService;

    public SearchController(
            SearchService searchService,
            SearchLogRepository searchLogRepository,
            PermissionService permissionService
    ) {
        this.searchService = searchService;
        this.searchLogRepository = searchLogRepository;
        this.permissionService = permissionService;
    }

    @GetMapping("/logs")
    @Operation(summary = "获取检索日志", description = "返回最近的检索性能日志")
    public List<SearchLogEntity> getLogs() {
        permissionService.requirePermission("system.manage");
        return searchLogRepository.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping("/pipeline")
    @Operation(
            summary = "Pipeline 检索（混合召回 + 融合 + 可选精排）",
            description = "同时查询 Elasticsearch（关键词）与 Qdrant（向量），使用 RRF 融合排序；当 useRerank=true 时，会调用模型服务进行 rerank。支持 filters 过滤（会自动把 camelCase 转为索引侧 snake_case 字段）。"
    )
    public PipelineSearchResponse pipeline(@Valid @RequestBody PipelineSearchRequest request) {
        return searchService.pipeline(request);
    }

    @PostMapping("/single")
    @Operation(
            summary = "单路检索（用于调试/对比）",
            description = "只走一种检索模式：keyword（ES）或 vector（Qdrant），不做融合。"
    )
    public SingleSearchResponse single(@Valid @RequestBody SingleSearchRequest request) {
        return searchService.single(request);
    }
}
