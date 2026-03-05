package com.graduation.knowledgeback.service;

import com.graduation.knowledgeback.api.dto.PipelineSearchRequest;
import com.graduation.knowledgeback.api.dto.QaRequest;
import com.graduation.knowledgeback.api.dto.QaResponse;
import com.graduation.knowledgeback.client.LlmClient;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class QaService {
    private final SearchService searchService;
    private final LlmClient llmClient;

    public QaService(SearchService searchService, LlmClient llmClient) {
        this.searchService = searchService;
        this.llmClient = llmClient;
    }

    public QaResponse answer(QaRequest req) {
        var pipelineReq = new PipelineSearchRequest(req.query(), req.topK(), req.useRerank(), Map.of());
        var pipelineResp = searchService.pipeline(pipelineReq);
        var sources = pipelineResp.results();

        int max = Math.min(6, sources.size());
        String context = java.util.stream.IntStream.range(0, max)
            .mapToObj(i -> "[" + (i + 1) + "] " + sanitize(sources.get(i).content()))
            .collect(Collectors.joining("\n"));

        String referenceList = java.util.stream.IntStream.range(0, max)
            .mapToObj(i -> {
                var s = sources.get(i);
                var src = s.source() != null ? s.source() : "unknown";
                var doc = s.docId() != null ? " (docId: " + s.docId() + ")" : "";
                var page = s.pageStart() != null ? " (page: " + s.pageStart() + ")" : "";
                return "[" + (i + 1) + "] " + src + doc + page;
            })
            .collect(Collectors.joining("\n"));

        String systemPrompt = "# Role\n" +
            "你是一位拥有 20 年经验的“资深压铸工艺专家”，专注于合金钢、铝镁合金等高难度压铸领域。你擅长从繁杂的技术文档中提取核心对策，并给出严谨、专业的生产建议。\n\n" +
            "# Task\n" +
            "请根据提供的【参考资料】回答【用户问题】。你的目标是为一线工程师提供精准的故障排查与解决方案。\n\n" +
            "# Critical Rules (必须严格遵守)\n" +
            "1. **精准去噪**：参考资料可能包含多个故障类型或无关的设计建议。请务必**只提取**与用户问题直接相关的部分，彻底忽略无关信息（例如：如果用户问的是“脱碳”，资料里提到的“内转角/R角”等设计问题属于干扰项，严禁出现在回答中）。\n" +
            "2. **忠于原文**：所有结论必须依据【参考资料】。如果资料中未提及相关对策，请诚实回答“根据现有知识库，未找到针对该问题的具体对策”，严禁凭空编造。\n" +
            "3. **结构化输出**：请按照以下格式组织回答：\n" +
            "   - 【现象诊断】：简要描述故障表现。\n" +
            "   - 【核心原因】：分析导致该问题的根本原因（分点陈述）。\n" +
            "   - 【解决对策】：给出具体的工艺调整、模具优化或操作建议（分点陈述）。\n" +
            "4. **引用标注**：在回答的关键信息点后，必须使用方括号标注来源编号，例如 [1] 或 [2]。\n" +
            "5. **参考来源清单**：在回答末尾提供“参考来源”小节，严格使用上方编号对应的文档列表（不要新增或合并编号）。\n\n" +
            "# Tone\n" +
            "专业、简练、客观，避免使用“我觉得”、“大概”等不确定词汇。";
        String userPrompt = "【用户问题】\n" + req.query() + "\n\n【参考资料】\n" + context + "\n\n【参考来源】\n" + referenceList + "\n\n请给出回答。";

        String answer = llmClient.chat(systemPrompt, userPrompt);
        // 移除回答中可能包含的 Markdown 加粗标记，避免前端渲染异常
        if (answer == null) answer = "";
        answer = answer.replaceAll("(?s)\\*\\*(.*?)\\*\\*", "$1");
        answer = answer.replaceAll("(?s)__(.*?)__", "$1");
        return new QaResponse(
                pipelineResp.searchId(),
                pipelineResp.query(),
                answer,
                pipelineResp.timingMs(),
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
}
