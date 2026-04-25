# 毕业设计中期进展报告：面向混合检索的工业知识库系统构建与精排接口开发

## 一、 课题背景与阶段任务

### 1. 课题/研究背景与研究内容
**技术现状与需求：**
随着工业4.0的深入发展，企业内部积累了大量的非结构化数据，如产品规格书、设备维护手册及故障排查日志。传统的工业知识查询手段主要依赖简单的文本搜索或人工查阅，存在关键词匹配不精准、无法理解行业特定的语义关联等痛点。尤其在处理“型号匹配”与“语义搜索”的结合上，单一架构难以满足高效运维的需求。

**理论意义：**
本研究通过引入混合检索（Hybrid Search）架构，探索并验证了倒排索引（BM25）与向量索引（Dense Vector）在工业领域的互补性，并研究了 Cross-Encoder 架构在垂直领域进行二次精排对检索效果（NDCG/MRR）的提升作用，为 RAG 架构在工业场景的落地提供了理论支持。

**实践意义：**
开发了一套面向工业领域的“铸见”知识库检索系统，通过 RRF (Reciprocal Rank Fusion) 融合算法与精排机制，确保关键设备手册和故障案例优先排序，大幅减少一线工程师的信息获取成本，具有显著的降本增效价值。

### 2. 本阶段任务要求

**（1） 拟解决的关键问题与主要任务**
1. **知识库系统的高可用架构搭建**：基于 Spring Boot 3 与微型服务思想，构建稳定、高容错的知识库核心业务系统，完成从用户查询到文档追溯的全链路后端落地。
2. **精排接口服务（Reranker API）的设计与开发**：基于 FastAPI 封装 Cross-Encoder 精排模型，开发高响应速度的标准化二次排序 Restful 接口，解决粗排候选集的精准度问题。
3. **异构检索组件的系统级整合**：打通倒排索引（Elasticsearch）、向量数据库（Qdrant）与关系型数据存储（MySQL），实现混合检索流水线在业务系统的工程化部署。
4. **知识治理与系统集成测试**：规范前后端通信标准（OpenAPI），串接 PDF 文档解析与向量化模块，确保整个知识库系统的端到端功能完整与高可用。

**（2） 毕业设计最终交付成果**
1. **软件系统**：一套可稳定运行的工业知识库原型系统（侧重于后端架构实现、数据链路管理与前后端系统集成）。
2. **精排接口微服务**：独立部署、具备良好并发处理能力的精排功能接口（Reranker API）及其技术参考规范。
3. **技术文档与论文**：一份不少于 3 万字的毕业设计说明书，重点阐述系统总体架构设计理念、精排接口开发细节及系统性能测试报告。

---

## 二、 本阶段工作完成情况

### 1. 阶段成果（重点阐述）
截至目前（第 13 周），本课题研发进展顺利，整体工作量已完成 **80%**。根据“面向混合检索的垂直领域系统开发”的课题核心，本阶段在后端系统建设、知识治理模块、数据管线打通以及精排微服务开发上取得了实质性落地成果。具体系统级产出如下：

**（1） 工业知识库系统业务层建设（四大核心后端模块落地）**
基于 Spring Boot 3 构建了核心业务分发后端，并使用 React + TypeScript 开发了交互终端。为体现工程实践的严谨性与代码的健壮性，主要在以下四个模块进行了深入的设计与开发：

*   **模块一：工业知识 ETL 与可视化后台治理模块（基于异步状态机的全链路入库）**
    *   **业务功能呈现**：为运维和管理人员提供了一站式的“知识大管家”。在前端 `AdminDashboard` 与 `Documents` 面板中，管理员可直接拖拽上传新增的设备说明书，并在表格中实时查看每份文档是处于“排队中”、“解析中”还是“已入库”状态，同时宏观看板还能呈现系统内总吞吐量和资源运转健康度，具备极高的开箱即用商用价值。
    *   **底层技术支撑**：彻底抛弃了简陋的同步阻塞模式。上传动作被 Spring `MultipartFile` 接收后，立刻返回 HTTP 202 并在 MySQL 打入 `PENDING` 凭证；紧接着 `@Async` 异步线程接管，运用**递归字符切片（Recursive Chunking）**进行特定窗口保留的语义解构；最后调用 `BulkRequest` 与声明式事务（`@Transactional`），向 ES 和 Qdrant 进行大批量多源异构并发写入，若遇任何组件宕机自动回滚，坚决保障知识库无“脏数据”。
    > **[此处插入图片: 知识库后台文档管理 (Documents) 表格台账或上传界面截图]**
    > *图 x：知识治理与跨组件文档处理状态台账界面*
    > 
    > **[此处插入图片: 数据加工状态监控大屏 (AdminDashboard) 界面截图]**
    > *图 x：系统后台文档解析吞吐、切片规模与数据库宏观状态监控看板*

*   **模块二：知识库文档管理与文件预览模块（结构化元数据治理）**
    *   **业务功能呈现**：实现了对海量工业文档的结构化治理。管理员可以在 `Documents` 页面对已入库的文档进行多维度筛选（按状态、文件类型或上传时间），并支持一键下载原始 PDF 文件。同时，集成了 `FilePreviewDrawer` 预览组件，无需跳转页面即可直接在侧边栏流畅查看文档正文内容，极大地提升了知识检索后的二次确认效率。
    *   **底层技术支撑**：在存储层采用了“文件系统 + 关系型数据库”的混合存储方案，MySQL 用于维护 `knowledge_documents` 表的核心元数据（如文件 MD5 校验和、物理路径、解析状态等）。通过自定义 `FileSystemResource` 处理器实现流式文件下载与预览接口，避免了大文件对 JVM 堆内存的瞬时挤占，确保了系统在高负载下的稳定性。
    > **[此处插入图片: 知识库文档列表与侧边预览抽屉截图]**
    > *图 x：知识库文档结构化展示与侧边预览交互界面*

*   **模块三：双核混合检索（Hybrid Search）前台流水线模块**
    *   **业务功能呈现**：为生产一线的工程师提供类似“百度/谷歌”般的极简极速搜索体验。前端用户只需自然输入（例如“VFD-C2000报警代码143如何排查”），系统便能在毫秒级内返回包含“特定型号精确匹配”与“操作语义泛化关联”的综合结果列表，无视语句倒装或部分输入偏差。
    *   **底层技术支撑**：针对单线程依次查库导致响应变慢的缺陷，在主搜索 Service 层深度运用 Java `CompletableFuture.supplyAsync()` 实现“双箭齐发”。一线程构建 `BoolQuery` 向 ES 发起 `ik_max_word` 词频检索抓取硬性参数；另一线程同时向 Qdrant 发起 HNSW 高维算法的余弦空间搜索。召回后，创新性地在 JVM 内存中应用 RRF 公式（$RRF= \frac{1}{k + rank_{ES}} + \frac{1}{k + rank_{Qdrant}}$）对其进行快速归一化算分与去重，取长补短。
    ```java
    // 异步混合检索核心实现逻辑：并行调度、多路召回与 RRF 融合算分
    public CompletableFuture<SearchResult> searchWithRerank(String query) {
        // 1. 并行发起多源检索请求 (CompletableFuture 为核心的非阻塞架构)
        var esTask = CompletableFuture.supplyAsync(() -> 
            esClient.search(query, "ik_max_word", 100)); // 倒排索引：强调关键词匹配
        var qdrantTask = CompletableFuture.supplyAsync(() -> 
            qdrantClient.search(query, 100)); // 向量索引：强调语义近邻

        // 2. 跨线程结果合并与 RRF (Reciprocal Rank Fusion) 异构打分
        return esTask.thenCombine(qdrantTask, (esHits, qHits) -> {
            Map<String, Double> rrfScores = new HashMap<>();
            
            // 计算 RRF 评分：RRF(d) = Σ 1 / (k + rank(d, r))
            processRrf(rrfScores, esHits, 60.0); 
            processRrf(rrfScores, qHits, 60.0);
            
            // 3. 截断粗排候选集（Top 50），作为精排微服务的入参
            List<String> candidates = getTopK(rrfScores, 50);
            
            // 4. 调用微服务精排接口 (Python Reranker API) 进行深度语义重排
            return modelClient.rerank(query, candidates);
        });
    }
    ```
    > **[此处插入图片: 知识库主页搜索交互或检索结果列表页面截图]**
    > *图 x：“铸见”终端前端混合检索交互与合并结果呈现界面*

*   **模块三：双核混合检索（Hybrid Search）前台流水线模块**
    ...existing code...
*   **模块四：RAG 大模型智能问答与 PDF 原文溯源模块**
    *   **业务功能呈现**：实现了“AI 总结解答 + 人工原件求证”的双轨闭环工作流。一方面，大语言模型化身“智能助理（AIPanel）”，将排查步骤像打字一样实时输出给用户；另一方面，若工程师对大模型生成的排查步骤有疑虑，点击旁边对应的引证角标 `[1]`，右侧随之滑出 `FilePreviewDrawer`（文件预览抽屉），直接展示这部分依据所在的“原始扫描件PDF页面”，并自动高亮相关文本。
    *   **底层技术支撑**：在流式输出上，应用 Server-Sent Events (SSE) 协议打通前后端异步推屏机制缓解白屏等待焦虑；在精准溯源上，利用切片系统入库时预留的 `page_number` 与 `file_id` 等 Metadata 元数据结构，结合 React 前端免路由的动态组件挂载技术，达成精确定位，构成了防范大模型“胡编乱造（幻觉）”的关键工程闭环。
    ```typescript
    // 前端定位高亮实现核心
    useEffect(() => {
        if (!loading && content && citationText && highlightRef.current) {
            // 平滑滚动定位到原文中 AI 参考的段落
            setTimeout(() => {
                highlightRef.current?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }, 500); 
        }
    }, [loading, content, citationText]);
    ```
    > **[此处插入图片: 带有 AIPanel 流式回复以及侧滑打开的 PDF 溯源 (FilePreviewDrawer) 截屏]**
    > *图 x：AI 智能 SSE 流式问答与 PDF 原文档精准定位溯源界面*

**（2） 精排微服务模型接口（Reranker API）的研发与独立部署**
受限于轻量级检索在处理长文本倒装、复杂语义重叠时的粗排召回精度不足问题，系统引入了 Cross-Encoder 二次精排机制。针对 Java 不善于调度海量张量计算的短板，进行了严密的微服务拆分解耦开发：
*   **严谨的入参拦截与数据契约（Pydantic）**：在 Python 端基于 FastAPI 搭建服务。制定 `/api/rerank` RESTful 接口标准，利用 `Pydantic` 要求其接收包裹着 `{query: str, documents: List[str]}` 的严格 JSON Body，若不满足则能在网关层即刻弹回 HTTP 422 错误，保证主站发送不可靠数据时计算节点不崩溃。
*   **Lifespan Context 模型堆内预热与张量批并行处理（Batch Tensor Inference）**：由于 Cross-Encoder 需要将 Query 和每一条 Document 拼接喂入 Transformer，反复启停会导致极为惨烈的延迟。采用了 FastAPI 原生的 `@asynccontextmanager` 生命周期管理钩子，在 ASGI 容器（Uvicorn）启动的初始态即完成了模型文件向物理内存/显存（RAM/VRAM）的加载，将推理过程从物理磁盘 I/O 中解脱出来。最终调度方法调用底层 `sentence-transformers` 引擎实现矩阵式的并发批量打分，杜绝低效的 `for` 循环线性打分耗时，使单次 50 项的候选二次精排在数百毫秒级返回，彻底补齐了微服务间的通信代沟。
    ```python
    # model_service/services/rerank_service.py - 服务层封装
    class RerankService:
        _instance = None
        _model = None

        def __new__(cls):
            if cls._instance is None:
                cls._instance = super(RerankService, cls).__new__(cls)
            return cls._instance

        def _load_model(self):
            # 从配置中心读取模型路径，实现与代码的解耦
            self._model = CrossEncoder(
                settings.RERANKER_MODEL_PATH, 
                max_length=512
            )

        def get_model(self):
            if self._model is None:
                self._load_model()
            return self._model

    # model_service/main.py - 生命周期管理
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # 系统启动即完成模型从物理磁盘到 RAM 的预热加载
        RerankService().get_model()
        yield

    # model_service/api/routes.py - API 路由
    @router.post("/rerank", response_model=RerankResponse)
    async def rerank(
        req: RerankRequest,
        rerank_service: RerankService = Depends(RerankService)
    ):
        # 矩阵式批量打分，避免逐条循环推理带来的延迟屏障
        model = rerank_service.get_model()
        scores = model.predict(req.pairs, batch_size=32)
        
        # 业务逻辑：将分数与原始文档配对并排序
        ranked_docs = sorted(
            zip(req.documents, scores), 
            key=lambda x: x[1], 
            reverse=True
        )
        return RerankResponse(results=ranked_docs)
    ```
    

**（3） 容器化的 DevOps 环境与异构中间件集群编排**
在底层研发环境搭建上，使用 `docker-compose.yml` 蓝图式脚本编排，一键拉起设定了明确内存配额（如限制 JVM 使用 `-Xms512m -Xmx512m` 以规避 OOM 影响宿主机）的 Elasticsearch 8.1x 容器、高性能 Qdrant 向量引擎守护进程等。采用 Docker Bridge 进行内部虚拟网络隔绝，显著提升了异构环境联调的易受控性。

### 2. 遇到的问题（系统工程方向）
*   **跨语言微服务集成时的网络阻塞与序列化开销**：当 Spring Boot 通过 HTTP 客户端同步调用 FastAPI 的精排接口时（即粗排输出了 50~100 个文本分块并全部发送给模型进行二次打分），海量数据的序列化传输加上 Python 的单线程异步阻塞，引发了严重的接口超时现象，导致检索前台产生长时间白屏或服务宕机假象。
*   **异构持久层的分布式一致性与脏读问题**：在工业知识库文件解析阶段（ETL 治理），需同时向 MySQL（元数据表）、Elasticsearch（倒排索引集群）与 Qdrant（向量数据库簇）写入记录。如果任意一端写入遇上网络波动或 OOM（内存溢出）奔溃，便会使其他两端产生孤立的“脏数据”或幽灵索引（即 MySQL 表示已入库，但实际上词库里查不到）。
*   **大规模重排序模型的内存并发调度瓶颈**：开发独立精排接口（Reranker API）时，由于自然语言模型体积极大，在 FastAPI 多节点（Workers）并发启动加载的情况下单机的物理显存与内存被极速跑满而触发 OOM 杀进程；而仅开启单点执行又使得高并发请求只能进行排队，吞吐量遭遇极速下降的瓶颈。

### 3. 解决系统问题的工程方案
*   **Spring Boot 异步熔断机制与 FastAPI 模型批处理改造**：在 Java 主后端引入带有连接池（Connection Pool）和重试-熔断（Circuit Breaker）机制的配置策略降低同步阻塞僵死风险；在 FastAPI 端修改评分推理函数结构，由单条处理更改为依赖张量特性（Batch Tensor Inference）的“短文批量处理”模式，彻底优化大吞吐下的模型调用响应速度。
*   **多存储后端的柔性事务控制与状态机机制**：重构系统的知识入库 Service 代码层，抛弃直接强耦合写入，引入柔性状态机。策略修改为：“首先在关系库表打入『就绪状态』标识与唯一任务ID -> 使用异步线程池分布投递并写入 ES 和 Qdrant -> 若某一部件写入抛出 Exception 则利用 Java 的事务回滚接口清除此前动作，以此确保一致性”。
*   **精排接口内存单例优化与生命周期绑定（Lifespan Context）**：优化了 FastAPI 与 Uvicorn 的服务挂载逻辑。设计了通过 `asynccontextmanager` 生命周期钩子将模型固化在进程启动初期的单例设计模式中进行预热缓存加载。所有的并发 Controller 只借用模型指针进行运算调用而不初始化实例化模型，成功完成了内存开销的削峰控制并极大地提高了系统抗并发击穿的能力。

---

## 三、 后期工作计划

### 1. 后期工作目标与任务

1.  **精排模型微调与量化部署**：基于前期构建的工业领域 `Query-Doc` 对数据集，采用对比学习策略对 `Cross-Encoder` 基座模型进行全量参数微调。重点引入**强负样本（Hard Negative）**以增强模型对工业术语（如特定报警代码、工艺参数）的细粒度判别能力。训练完成后进行 **ONNX/FP16 量化**导出，提升精排接口在 CPU 上的推理时延。
2.  **系统全链路集成与缓存调优**：将微调后的精排服务无缝接入“双路召回 → RRF 融合 → 神经精排”的完整数据流。通过优化跨服务通信逻辑，并尝试引入 **Redis 语义缓存机制**，缓存高频查询的 Top-K 结果，确保端到端查询耗时控制在 500ms 以内，满足工业场景的实时响应要求。
3.  **对比实验设计与量化评估**：构建包含 100 条标准工业查询的评估集（Ground Truth），执行严格的**消融实验**。对比分析：①单一 BM25 检索、②RRF 混合检索、③混合检索+微调精排（本系统）三种架构。采用 **MRR@5、NDCG@10** 作为核心评价指标，量化分析精排机制对解决“语义漂移”问题的实际贡献。
4.  **论文撰写与答辩准备**：系统梳理混合检索架构设计、RRF 算法实现原理与消融实验数据，按照学术规范撰写不少于 1.2 万字的毕业设计说明书。完成代码归档、系统功能演示视频录制及答辩 PPT 制作，确保逻辑严密、数据真实，按期完成任务。

### 2. 后期工作安排与进度计划

| 时间节点 | 主要任务内容 | 预期成果 |
| :--- | :--- | :--- |
| **4.10 - 4.25** | **模型精调与量化：** 构建 Hard Negative 数据集并完成模型训练，执行 ONNX/FP16 量化导出。 | 完成 Bge-Reranker 工业级权重微调 |
| **4.26 - 5.05** | **全链路集成与调优：** 接入微调后的精排服务，集成 Redis 语义缓存，优化端到端时延。 | 端到端检索时延控制在 500ms 内 |
| **5.06 - 5.15** | **定性/定量实验评估：** 执行消融实验模型对比，采集 MRR@5 与 NDCG@10 指标数据，录制演示视频。 | 完成检索效能量化分析报告 |
| **5.16 - 5.25** | **论文撰写与归档：** 完成 1.2 万字论文初稿，查重、降重并准备答辩材料。 | 提交高质量毕业论文与工程源码 |

---

## 四、 结论
项目目前运行稳定，基于 **Spring Boot 3 + FastAPI** 的异构微服务架构已完全跑通。核心的**双路并行检索**与 **RRF 融合算法**已在业务逻辑层落地，前端**流式 RAG 问答与 PDF 精准原文溯源**功能也已初步实现演示能力。

虽然精排模型仍处于 **Hard Negative** 策略微调与量化导出的收尾阶段，但由于系统已预留了标准化的 **Restful API** 接口契约，且前端已完成了对核心业务逻辑的闭环验证，剩余的实验指标采集与论文撰写工作路径清晰。本人有信心在接下来的 6 周内，通过消融实验量化精排对 **MRR@5/NDCG@10** 指标的提升，按时保质完成毕业设计，最终交付一套工业级水准的智能知识搜索系统。

---

## 五、 参考文献
[1] Lewis P, Perez E, Piktus A, et al. Retrieval-augmented generation for knowledge-intensive NLP tasks[J]. Advances in Neural Information Processing Systems, 2020, 33: 9459-9474. (RAG 架构奠基之作)
[2] Reimers N, Gurevych I. Sentence-BERT: Sentence embeddings using Siamese BERT-networks[C]//Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing. 2019: 3982-3992. (向量检索核心理论)
[3] Thakur N, Reimers N, Daxenberger J, et al. BEIR: A heterogeneous benchmark for information retrieval[C]//Thirty-fifth Conference on Neural Information Processing Systems Datasets and Benchmarks Track. 2021. (混合检索评估标准)
[4] Borgeaud S, Mensch A, Hoffmann J, et al. Improving language models by retrieving from trillions of tokens[C]//International conference on machine learning. PMLR, 2022: 2206-2240. (大规模检索增强研究)
[5] 王茂楠, 刘洋, 等. 工业领域大规模语言模型检索增强技术研究综述[J]. 计算机学报, 2023. (国内工业 RAG 现状参考)

