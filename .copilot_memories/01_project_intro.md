# 项目简介

## 1. 毕设选题
**面向混合检索的工业知识库系统构建与精排接口开发**

## 2. 研究背景与意义
- **背景**：解决工业非结构化数据（手册、日志）检索中，关键词匹配不足（意匹配）与向量检索不精确（词匹配）的矛盾。
- **意义**：构建“混合检索 + Cross-Encoder 精排”的 RAG 架构，提升工业运维查询效率。

## 3. 核心功能模块
- **数据治理 (ETL)**：PDF/Excel 智能解析与语义切片。
- **混合检索 (Recall)**：Elasticsearch + Qdrant 双引擎 RRF 融合。
- **精排服务 (Rerank)**：微调后的 Cross-Encoder 推理 API。
- **用户界面 (Web)**：现代化 React 前端检索与溯源演示。

## 4. 技术栈
- **后端**：Spring Boot 3 (Java), FastAPI (Python)
- **前端**：React, Vite, Tailwind CSS
- **检索/存储**：Elasticsearch, Qdrant, Docker
- **AI模型**：Sentence-Transformers (Embedding), Cross-Encoder (Reranker)
