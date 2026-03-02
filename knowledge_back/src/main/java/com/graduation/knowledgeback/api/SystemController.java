package com.graduation.knowledgeback.api;

import com.graduation.knowledgeback.api.dto.SystemStatusResponse;
import com.graduation.knowledgeback.client.ElasticsearchClient;
import com.graduation.knowledgeback.client.ModelServiceClient;
import com.graduation.knowledgeback.client.QdrantClient;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system")
@Tag(name = "系统 System", description = "系统健康与依赖状态检查：Elasticsearch、Qdrant、模型服务。")
public class SystemController {
    private final ElasticsearchClient elasticsearchClient;
    private final QdrantClient qdrantClient;
    private final ModelServiceClient modelServiceClient;

    public SystemController(ElasticsearchClient elasticsearchClient, QdrantClient qdrantClient, ModelServiceClient modelServiceClient) {
        this.elasticsearchClient = elasticsearchClient;
        this.qdrantClient = qdrantClient;
        this.modelServiceClient = modelServiceClient;
    }

    @GetMapping("/status")
        @Operation(
            summary = "系统依赖状态",
            description = "返回 ES 集群健康状态、Qdrant collection 点数量、模型服务 rerank 模型信息（如果可用）。"
        )
    public SystemStatusResponse status() {
        String es = "unknown";
        Integer indexCount = null;
        Integer nodeCount = null;
        Long latencyMs = null;
        Long qCount = null;
        String reranker = "unknown";

        try {
            var start = System.nanoTime();
            var esJson = elasticsearchClient.clusterHealth();
            latencyMs = (System.nanoTime() - start) / 1_000_000;
            if (esJson != null && esJson.get("status") != null) {
                es = esJson.get("status").asText();
            }
            if (esJson != null && esJson.get("number_of_nodes") != null && esJson.get("number_of_nodes").isNumber()) {
                nodeCount = esJson.get("number_of_nodes").asInt();
            }
            indexCount = elasticsearchClient.indexCount();
        } catch (Exception ignore) {
            es = "down";
            indexCount = null;
            nodeCount = null;
            latencyMs = null;
        }

        try {
            var qJson = qdrantClient.collectionInfo();
            if (qJson != null) {
                var result = qJson.get("result");
                if (result != null) {
                    var points = result.get("points_count");
                    if (points != null && points.isNumber()) {
                        qCount = points.asLong();
                    }
                }
            }
        } catch (Exception ignore) {
            qCount = null;
        }

        try {
            var m = modelServiceClient.health();
            if (m != null && m.get("rerank_model") != null && !m.get("rerank_model").isNull()) {
                reranker = m.get("rerank_model").asText();
            } else {
                reranker = "not_configured";
            }
        } catch (Exception ignore) {
            reranker = "down";
        }

        return new SystemStatusResponse(es, indexCount, nodeCount, latencyMs, qCount, reranker);
    }

    @GetMapping("/health")
    @Operation(summary = "健康检查", description = "用于容器编排/反向代理的健康探针：后端进程存活即返回 UP。")
    public java.util.Map<String, String> health() {
        return java.util.Map.of("status", "UP");
    }
}
