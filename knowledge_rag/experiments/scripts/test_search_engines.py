from elasticsearch import Elasticsearch
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
import os

# ================= 配置区域 =================
ES_HOST = "http://localhost:9200"
QDRANT_HOST = "http://localhost:6333"
ES_INDEX = "knowledge_chunks"
QDRANT_COLLECTION = "knowledge_chunks"

# 加载模型 (用于把问题变成向量)
print("⏳ 正在加载模型 (可能需要几秒钟)...")
# 重要：查询向量维度必须与 Qdrant collection 建库维度一致。
# 你当前入库脚本默认用 BAAI/bge-base-zh-v1.5（768维），所以这里默认也用它。
# 如果你改用其它模型（比如 all-MiniLM-L6-v2=384维 / bge-small-zh-v1.5=512维），需要先用同一模型重新入库（--recreate）。
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-base-zh-v1.5")
model = SentenceTransformer(EMBED_MODEL)
# ===========================================

def search_es(query, top_k=3):
    """测试 ES 关键词搜索"""
    try:
        es = Elasticsearch(ES_HOST)
        # 标准的 BM25 查询
        response = es.search(
            index=ES_INDEX,
            query={
                "match": {
                    "content": query  # 在 content 字段里搜
                }
            },
            size=top_k
        )
        
        print(f"\n🔍 [Elasticsearch] 搜索: '{query}'")
        hits = response['hits']['hits']
        if not hits:
            print("   (无结果)")
            return

        for i, hit in enumerate(hits):
            score = hit['_score']
            content = hit['_source']['content']
            source = hit['_source'].get('source', '未知文件')
            # 只打印前 50 个字预览
            print(f"   {i+1}. [{score:.2f}] {source} | {content[:50]}...")
            
    except Exception as e:
        print(f"❌ ES 搜索出错: {e}")

def search_qdrant(query, top_k=3):
    """测试 Qdrant 向量搜索"""
    try:
        client = QdrantClient(url=QDRANT_HOST)

        # 0. 获取 collection 预期向量维度（用于提前报错提示）
        expected_dim = None
        try:
            col = client.get_collection(QDRANT_COLLECTION)
            # qdrant 返回结构在不同版本略有差异，做容错读取
            expected_dim = getattr(getattr(getattr(col, "config", None), "params", None), "vectors", None)
            expected_dim = getattr(expected_dim, "size", None)
        except Exception:
            expected_dim = None
        
        # 1. 把问题变成向量
        query_vector = model.encode(query).tolist()

        if expected_dim is not None and len(query_vector) != expected_dim:
            raise ValueError(
                f"Query vector dim mismatch: expected {expected_dim}, got {len(query_vector)}. "
                f"Current EMBED_MODEL={EMBED_MODEL}. "
                "Fix: use the same model as indexing, or reindex Qdrant with this model."
            )
        
        # 2. 去库里搜（qdrant-client 1.16.x 使用 query_points）
        result = client.query_points(
            collection_name=QDRANT_COLLECTION,
            query=query_vector,
            limit=top_k,
            with_payload=True,
        )
        results = result.points
        
        print(f"\n🧠 [Qdrant] 搜索: '{query}'")
        if not results:
            print("   (无结果)")
            return

        for i, hit in enumerate(results):
            score = hit.score
            payload = hit.payload or {}
            # 注意：Qdrant 的内容存在 payload 里
            content = payload.get('content', '')
            source = payload.get('source', '未知文件')
            print(f"   {i+1}. [{score:.4f}] {source} | {content[:50]}...")
            
    except Exception as e:
        print(f"❌ Qdrant 搜索出错: {e}")

if __name__ == "__main__":
    # --- 这里填你想测试的问题 ---
    test_queries = [
        "压铸机锁模故障怎么办",      # 场景1：精准故障
        "ADC12铝合金温度设置",       # 场景2：工艺参数
        "铸件表面有气孔",            # 场景3：模糊描述
        "E-01"                      # 场景4：纯代码 (ES应该比Qdrant强)
    ]
    
    for q in test_queries:
        print("-" * 50)
        search_es(q)
        search_qdrant(q)
    print("-" * 50)