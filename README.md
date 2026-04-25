# 📖 铸见 (CastInsight) - 工业知识库 RAG 系统

> 让每一份工业文档，都能在关键时刻开口说话。
> 基于混合检索与神经精排技术的工业级知识问答解决方案。

## 🌟 项目简介

本项目针对工业场景下非结构化文档（如压铸机维护手册、故障日志）检索不准、难以溯源的痛点，构建了一套完整的 RAG (检索增强生成) 流水线。通过“关键词匹配 + 语义向量”的双引擎混合检索，配合微调后的 Cross-Encoder 精排模型，实现了工业知识的精准获取与智能问答。

### 核心亮点

*   **现代交互设计**：采用毛玻璃（Glassmorphism）视觉风格与沉浸式搜索体验，提供流畅的动画反馈。
*   **混合检索架构**：融合 Elasticsearch (BM25) 与 Qdrant (HNSW) 召回引擎，平衡查准与查全。
*   **神经精排优化**：集成 Rerank 环节，有效过滤检索噪声（如处理“内转角”设计干扰脱碳问题）。
*   **全链路可回溯**：AI 回答关联原始文档页码，支持 PDF 实时预览与锚点定位。
*   **企业级特性**：支持语义缓存、请求限流、异步处理流水线及任务监控。

## 🏗️ 系统架构

项目采用三端分离的微服务架构：

*   **knowledge_front (前端)**: 基于 **React + TypeScript + Tailwind CSS** 构建，集成 Framer Motion 动画库与 Lucide 图标，负责现代化 UI 交互与 PDF 渲染。
*   **knowledge_back (后端)**: 基于 **Spring Boot 3** 构建，负责业务编排、混合检索调度、权限控制与 Redis 缓存。
*   **knowledge_rag (算法/模型服务)**: 基于 **Python FastAPI** 构建，负责 BGE 向量化、Cross-Encoder 精排推理及文档解析切片。

## 🛠️ 技术栈

| 模块 | 技术选型 |
| :--- | :--- |
| **前端** | React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide React, Vite |
| **后端** | Spring Boot 3, MyBatis-Plus, Redis, MySQL 8 |
| **模型服务** | Python 3.10, FastAPI, HuggingFace (Transformers/Sentence-Transformers), PyTorch |
| **检索引擎** | Elasticsearch 8.x, Qdrant |
| **LLM API** | SiliconFlow (DeepSeek-V3 / Qwen2.5) |

## 🚀 快速开始

### 1. 环境准备

*   Docker Desktop / Docker Compose
*   Java 17+, Node.js LTS, Python 3.10+
*   本地 MySQL 8.4（本项目当前使用 `root / 123456`，库名 `knowledge_base`）
*   申请 SiliconFlow API Key（如需启用 LLM 问答）

### 2. 部署中间件

```bash
cd knowledge_rag
docker compose pull
docker compose up -d
```

说明：`docker-compose.yml` 里当前只包含 Elasticsearch、Kibana、Qdrant，MySQL 使用本地安装，不在 Docker 内启动。

### 3. 启动模型服务 (knowledge_rag)

```bash
cd knowledge_rag
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn model_service.main:app --host 0.0.0.0 --port 8000 --reload
```

启动后可访问：`http://127.0.0.1:8000/health`

### 4. 启动后端 (knowledge_back)

1.  确认 `knowledge_back/src/main/resources/application.yml` 已配置为本地 MySQL：`localhost:3306`、`root`、`123456`，数据库名 `knowledge_base`。
2.  在 `knowledge_back` 目录下执行：

```bash
mvn spring-boot:run
```

如果你更习惯 IDE，也可以直接运行 `KnowledgeBackApplication.java`。

### 5. 启动前端 (knowledge_front)

```bash
cd knowledge_front
npm install
npm run dev
```

启动后默认访问：`http://localhost:5173`

## 📁 目录说明

```text
CODE
├── data                # 存放初始化 SQL 脚本及测试 PDF 文档
├── knowledge_back      # Spring Boot 业务逻辑代码
├── knowledge_front     # React 前端工程 (Vite + Tailwind)
├── knowledge_rag       # Python 推理服务与文档处理脚本
└── .gitignore          # Git 忽略配置
```
