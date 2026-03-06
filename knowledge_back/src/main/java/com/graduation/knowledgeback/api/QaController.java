package com.graduation.knowledgeback.api;

import com.graduation.knowledgeback.api.dto.QaRequest;
import com.graduation.knowledgeback.api.dto.QaResponse;
import com.graduation.knowledgeback.persistence.QaLogEntity;
import com.graduation.knowledgeback.service.QaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/qa")
@Tag(name = "问答 QA", description = "检索 + LLM 生成的问答接口")
public class QaController {
    private final QaService qaService;

    public QaController(QaService qaService) {
        this.qaService = qaService;
    }

    @PostMapping("/answer")
    @Operation(summary = "问答生成", description = "基于检索结果调用 LLM 生成答案")
    public QaResponse answer(@Valid @RequestBody QaRequest request) {
        return qaService.answer(request);
    }

    @GetMapping("/logs")
    @Operation(summary = "查询日志", description = "获取最近的问答日志")
    public List<QaLogEntity> getLogs() {
        return qaService.getLogs();
    }
}
