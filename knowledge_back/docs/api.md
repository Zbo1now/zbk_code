# Knowledge Back API 接口文档（v1）

- 基础地址：`http://localhost:8080`
- Swagger UI：`/swagger-ui`
- OpenAPI：`/v3/api-docs`（已导出到 `docs/openapi.json` / `docs/openapi.yaml`）
- 约定：对外 JSON 字段使用 **camelCase**；内部对 Python 模型服务使用 **snake_case**。

## 启动方式（推荐）

在本机 Windows + 中文路径环境下，`mvn spring-boot:run` 可能出现主类 ClassNotFound 的问题。推荐使用可执行 JAR 启动：

```bash
cd knowledge_back
mvn -DskipTests package
java -jar target/knowledge-back-0.1.0.jar
```

## 1. 检索 Search

### 1.1 Pipeline 检索（ES + Qdrant + RRF，可选 Rerank）
- URL：`POST /api/v1/search/pipeline`
- Body（JSON）：

```json
{
  "query": "压铸 模具 热处理",
  "topK": 5,
  "useRerank": true,
  "filters": {
    "docType": "txt",
    "source": "virtual_articles"
  }
}
```

- filters 说明：
  - 后端会把 filters key 归一化并转为索引侧字段（snake_case）。
  - 特例映射：`docType -> file_type`，`machineType -> machine_type`。

- Response（示例）：

```json
{
  "searchId": "b0a7c4f5fdfb44d8a1b7d8c1d2a3e4f5",
  "query": "压铸 模具 热处理",
  "totalTimeMs": 123,
  "timingMs": {
    "esMs": 22,
    "qdrantMs": 40,
    "fusionMs": 3,
    "rerankMs": 50
  },
  "results": [
    {
      "rank": 1,
      "score": 0.87,
      "content": "...",
      "source": "...",
      "pageStart": 1,
      "pageEnd": 1,
      "docId": "<payload.doc_id>",
      "chunkIds": ["<payload.chunk_id>"] ,
      "retrievalSource": "rrf"
    }
  ]
}
```

字段要点：
- `docId`：与索引 payload 的 `doc_id` 对齐。
- `chunkIds`：数组形式，预留对齐 RAG 端“合并后结果对应多个 chunk”的场景。

### 1.2 Single 检索（不做融合/精排）
- URL：`POST /api/v1/search/single`
- 说明：用于快速单通道检索/调试。

## 2. 知识库 Knowledge（单库模式）

### 2.1 上传导入（当前仅支持 JSONL）
- URL：`POST /api/v1/knowledge/upload`
- Content-Type：`multipart/form-data`
- Form fields：
  - `file`：上传文件（仅支持 `.jsonl`）
  - `metadata`：可选，字符串（JSON）

- Response：

```json
{
  "taskId": "<taskId>",
  "docId": null,
  "status": "processing",
  "message": "File uploaded, processing started."
}
```

说明：JSONL 可能包含多个 `doc_id`（批量导入），因此这里 `docId` 返回 `null`，以 `GET /documents` 查看导入结果。

### 2.2 文档列表
- URL：`GET /api/v1/knowledge/documents?page=1&pageSize=10`
- Response：

```json
{
  "page": 1,
  "pageSize": 10,
  "total": 100,
  "items": [
    {
      "docId": "<payload.doc_id>",
      "originalFilename": "...",
      "storedPath": "...",
      "status": "INDEXED",
      "createdAt": "2026-02-28T12:00:00Z",
      "errorMessage": null
    }
  ]
}
```

### 2.3 删除文档（ES + Qdrant 同步删除）
- URL：`DELETE /api/v1/knowledge/documents/{docId}`
- 说明：这里的 `docId` 等同于索引 payload 的 `doc_id`。
- Response：异步任务（同 upload）。

### 2.4 重建索引（从配置的 JSONL 重新导入）
- URL：`POST /api/v1/knowledge/rebuild`
- Body（可选）：

```json
{
  "rebuildEs": true,
  "rebuildQdrant": true,
  "reEmbed": true
}
```

说明：当前实现中 `reEmbed` 暂未做严格区分（重建写入 Qdrant 时会进行向量化）。

### 2.5 任务状态查询
- URL：`GET /api/v1/knowledge/tasks/{taskId}`

## 3. 系统 System

### 3.1 系统状态（ES/Qdrant/模型服务）
- URL：`GET /api/v1/system/status`

### 3.2 健康检查
- URL：`GET /api/v1/system/health`
- Response：`{"status":"UP"}`

## 4. 评测 Evaluation

### 4.1 相关性反馈
- URL：`POST /api/v1/evaluation/feedback`
- Body（JSON）：

```json
{
  "searchId": "<searchId>",
  "docId": "<docId>",
  "chunkId": "<chunkId>",
  "rank": 1,
  "isRelevant": true
}
```

## 5. 错误与状态码（约定）

- `200`：成功
- `400`：参数校验失败（如 query 为空、topK 越界等）
- `404`：任务/文档不存在（查询任务、删除文档等场景）
- `500`：后端内部异常（ES/Qdrant/模型服务不可用或入库失败等）
