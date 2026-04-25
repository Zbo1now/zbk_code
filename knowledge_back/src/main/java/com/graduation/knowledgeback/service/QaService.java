package com.graduation.knowledgeback.service;

import com.graduation.knowledgeback.api.dto.PipelineSearchRequest;
import com.graduation.knowledgeback.api.dto.QaRequest;
import com.graduation.knowledgeback.api.dto.QaResponse;
import com.graduation.knowledgeback.api.dto.SearchResultItem;
import com.graduation.knowledgeback.client.LlmClient;
import com.graduation.knowledgeback.persistence.QaLogEntity;
import com.graduation.knowledgeback.persistence.QaLogRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class QaService {
    private final SearchService searchService;
    private final LlmClient llmClient;
    private final QaLogRepository qaLogRepository;

    public QaService(SearchService searchService, LlmClient llmClient, QaLogRepository qaLogRepository) {
        this.searchService = searchService;
        this.llmClient = llmClient;
        this.qaLogRepository = qaLogRepository;
    }

    public List<QaLogEntity> getLogs() {
        return qaLogRepository.findAllByOrderByTimestampDesc();
    }

    public QaResponse answer(QaRequest req) {
        long start = System.currentTimeMillis();
        String searchId = UUID.randomUUID().toString();
        Map<String, Long> searchTiming = Map.of();
        String answer = "";
        List<SearchResultItem> sources = List.of();

        try {
            var pipelineReq = new PipelineSearchRequest(req.query(), req.topK(), req.useRerank(), Map.of());
            var pipelineResp = searchService.pipeline(pipelineReq);
            if (pipelineResp != null) {
                sources = pipelineResp.results() != null ? pipelineResp.results() : List.of();
                searchId = pipelineResp.searchId();
                searchTiming = pipelineResp.timingMs();
            }

            if (sources.isEmpty()) {
                answer = "抱歉，作为压铸工艺专家，我无法回答与压铸模具无关的问题（如天气、娱乐等）。\n\n您可以尝试询问：\n1. 压铸模具故障排查\n2. H13钢热处理工艺\n3. 材料性能对比\n\n请尝试提问相关的技术问题。";
            } else {
                final List<SearchResultItem> finalSources = sources;
                int max = Math.min(6, finalSources.size());
                String context = java.util.stream.IntStream.range(0, max)
                    .mapToObj(i -> "[" + (i + 1) + "] " + sanitize(finalSources.get(i).content()))
                    .collect(Collectors.joining("\n"));

                String referenceList = java.util.stream.IntStream.range(0, max)
                    .mapToObj(i -> {
                        var s = finalSources.get(i);
                        var src = s.source() != null ? s.source() : "unknown";
                        return "[" + (i + 1) + "] " + extractFileName(src);
                    })
                    .collect(Collectors.joining("\n"));

                String systemPrompt = "# Role\n" +
                    "你是一位拥有 20 年经验的“资深压铸工艺专家”，专注于合金钢、铝镁合金等高难度压铸领域。你擅长从繁杂的技术文档中提取要点，并给出严谨、专业的工程建议。\n\n" +
                    "# Task\n" +
                    "请根据提供的【参考资料】回答【用户问题】。用户可能提出故障排查、原理解释、工艺对比或背景知识问题，你需要判断问题类型并选择合适的回答结构。\n\n" +
                    "# Critical Rules (必须严格遵守)\n" +
                    "1. **精准去噪**：参考资料可能包含多个故障类型或无关的设计建议。请务必**只提取**与用户问题直接相关的部分，彻底忽略无关信息。\n" +
                    "2. **忠于原文**：所有结论必须依据【参考资料】。如果资料中未提及相关内容，请诚实回答“根据现有知识库，未找到相关内容”。严禁凭空编造。\n" +
                    "3. **结构化输出**：根据问题类型选择结构化格式：\n" +
                    "   - 若为故障排查类：\n" +
                    "     - 【现象诊断】\n" +
                    "     - 【核心原因】（分点）\n" +
                    "     - 【解决对策】（分点）\n" +
                    "   - 若为原理/知识/对比类：\n" +
                    "     - 【要点概述】\n" +
                    "     - 【关键依据】（分点）\n" +
                    "     - 【注意事项/适用范围】（分点）\n" +
                    "4. **引用标注**：在回答的关键信息点后，必须使用方括号标注来源编号，例如 [1] 或 [2]。\n" +
                    "";
                String userPrompt = "【用户问题】\n" + req.query() + "\n\n【参考资料】\n" + context + "\n\n【参考来源】\n" + referenceList + "\n\n请给出回答。";

                answer = llmClient.chat(systemPrompt, userPrompt);
                if (answer == null) answer = ""; 
                
                // 为了输出整洁进行后处理
                answer = answer.replaceAll("(?s)\\*\\*(.*?)\\*\\*", "$1");
                answer = answer.replaceAll("(?s)__(.*?)__", "$1");


                // 如果模型明确表示未找到相关内容，清空来源列表
                // 这可以防止前端显示不相关的引用链接
                if (answer.contains("未找到") && (answer.contains("相关内容") || answer.contains("相关收录") || answer.contains("压铸工艺") || answer.contains("材料科学"))) {
                     sources = List.of(); // 重新分配返回的变量
                }
            }
        } catch (Exception e) {
             System.err.println("QA Processing failed: " + e.getMessage());
             e.printStackTrace();
             answer = "系统处理您的请求时遇到意外错误，请稍后重试。";
             // 来源列表保持为空
        }

        // 记录日志
        long duration = System.currentTimeMillis() - start;
        try {
            // 存储完整回答用于详细审查
            // 如果需要处理空来源的情况（虽然 sources 已初始化）
            qaLogRepository.save(new QaLogEntity(req.query(), answer, duration, sources.size(), Instant.now()));
        } catch (Exception e) {
            // 忽略日志错误，防止导致服务中断
            System.err.println("Failed to save QA log: " + e.getMessage());
        }

        return new QaResponse(
                searchId,
                req.query(),
                answer,
                searchTiming,
                sources
        );
    }

    private String sanitize(String text) {
        if (text == null) return "";
        var compact = text.replaceAll("\\s+", " ").trim();
        if (compact.length() > 400) {
            return compact.substring(0, 400) + "...";
        }
        return compact;
    }

    private String extractFileName(String path) {
        if (path == null || path.isBlank()) return "unknown";
        var normalized = path.replace("\\\\", "/");
        var idx = normalized.lastIndexOf('/');
        if (idx >= 0 && idx + 1 < normalized.length()) {
            return stripExtension(normalized.substring(idx + 1));
        }
        return stripExtension(normalized);
    }

    private String stripExtension(String name) {
        if (name == null) return "unknown";
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            return name.substring(0, dot);
        }
        return name;
    }
}
