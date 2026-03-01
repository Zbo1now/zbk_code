package com.graduation.knowledgeback.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "工业知识库后端 API",
                version = "v1",
                description = "毕设后端接口：单知识库模式；混合检索（ES + Qdrant）+ RRF 融合 + 可选 rerank；包含导入、重建、任务查询与反馈采集。"
        )
)
public class OpenApiConfig {
}