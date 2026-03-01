package com.graduation.knowledgeback.api;

import com.graduation.knowledgeback.api.dto.FeedbackRequest;
import com.graduation.knowledgeback.persistence.FeedbackEntity;
import com.graduation.knowledgeback.persistence.FeedbackRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/evaluation")
@Tag(name = "评测 Evaluation", description = "检索效果评测与用户反馈数据采集。")
public class EvaluationController {
    private final FeedbackRepository feedbackRepository;

    public EvaluationController(FeedbackRepository feedbackRepository) {
        this.feedbackRepository = feedbackRepository;
    }

    @PostMapping("/feedback")
    @Operation(
            summary = "相关性反馈",
            description = "保存一次检索结果的人工反馈（是否相关、rank 等），用于离线评测或后续 rerank/融合策略优化。"
    )
    public Map<String, String> feedback(@Valid @RequestBody FeedbackRequest request) {
        feedbackRepository.save(new FeedbackEntity(
                request.searchId(),
                request.docId(),
                request.chunkId(),
                request.rank(),
                request.isRelevant()
        ));
        return Map.of("status", "ok");
    }
}
