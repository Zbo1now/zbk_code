package com.graduation.knowledgeback.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.client.ElasticsearchClient;
import com.graduation.knowledgeback.client.ModelServiceClient;
import com.graduation.knowledgeback.client.QdrantClient;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class IndexingService {
    private final ObjectMapper objectMapper;
    private final ElasticsearchClient elasticsearchClient;
    private final QdrantClient qdrantClient;
    private final ModelServiceClient modelServiceClient;

    public IndexingService(ObjectMapper objectMapper,
                           ElasticsearchClient elasticsearchClient,
                           QdrantClient qdrantClient,
                           ModelServiceClient modelServiceClient) {
        this.objectMapper = objectMapper;
        this.elasticsearchClient = elasticsearchClient;
        this.qdrantClient = qdrantClient;
        this.modelServiceClient = modelServiceClient;
    }

    public List<DocumentMeta> rebuildFromJsonl(Path jsonlPath, int embedBatchSize, boolean rebuildEs, boolean rebuildQdrant) throws Exception {
        var health = modelServiceClient.health();
        int dim = health != null && health.get("embed_dim") != null ? health.get("embed_dim").asInt() : 768;

        if (rebuildQdrant) {
            qdrantClient.deleteCollectionIfExists();
            qdrantClient.createCollection(dim);
        }

        if (rebuildEs) {
            elasticsearchClient.deleteIndexIfExists();
            elasticsearchClient.createIndex();
        }

        return indexJsonl(jsonlPath, embedBatchSize);
    }

    public List<DocumentMeta> indexDocumentChunks(List<JsonNode> chunks, int embedBatchSize) throws Exception {
        var docMetas = new LinkedHashMap<String, DocumentMeta>();
        var texts = new ArrayList<String>();
        var payloads = new ArrayList<JsonNode>();
        
        for (JsonNode chunk : chunks) {
            String content = chunk.get("content").asText();
            texts.add(content);
            payloads.add(chunk);
            
            // Extract meta (similar to indexJsonl)
            JsonNode docIdNode = chunk.get("doc_id");
            if (docIdNode != null) {
                String docId = docIdNode.asText();
                docMetas.computeIfAbsent(docId, id -> new DocumentMeta(
                    id, 
                    textOrNull(chunk.get("title")),
                    textOrNull(chunk.get("source")),
                    textOrNull(chunk.get("file_type"))
                ));
            }
            
            if (texts.size() >= embedBatchSize) {
                flushBatch(texts, payloads);
                texts.clear();
                payloads.clear();
            }
        }
        
        if (!texts.isEmpty()) {
            flushBatch(texts, payloads);
        }
        
        return new ArrayList<>(docMetas.values());
    }

    public List<DocumentMeta> indexJsonl(Path jsonlPath, int embedBatchSize) throws Exception {
        if (!Files.exists(jsonlPath)) {
            throw new IllegalArgumentException("JSONL not found: " + jsonlPath);
        }

        var docMetas = new LinkedHashMap<String, DocumentMeta>();

        try (BufferedReader reader = Files.newBufferedReader(jsonlPath, StandardCharsets.UTF_8)) {
            var texts = new ArrayList<String>();
            var payloads = new ArrayList<JsonNode>();
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                var obj = objectMapper.readTree(line);
                var chunkId = obj.get("chunk_id");
                var content = obj.get("content");
                if (chunkId == null || !chunkId.isTextual() || content == null || !content.isTextual()) {
                    continue;
                }

                // Extract document-level meta (doc_id/title/source/file_type)
                var docIdNode = obj.get("doc_id");
                if (docIdNode != null && docIdNode.isTextual()) {
                    var docId = docIdNode.asText();
                    docMetas.computeIfAbsent(docId, id -> new DocumentMeta(
                            id,
                            textOrNull(obj.get("title")),
                            textOrNull(obj.get("source")),
                            textOrNull(obj.get("file_type"))
                    ));
                }

                texts.add(content.asText());
                payloads.add(obj);

                if (texts.size() >= embedBatchSize) {
                    flushBatch(texts, payloads);
                    texts.clear();
                    payloads.clear();
                }
            }
            if (!texts.isEmpty()) {
                flushBatch(texts, payloads);
            }
        }

        return new ArrayList<>(docMetas.values());
    }

    private void flushBatch(List<String> texts, List<JsonNode> payloads) throws Exception {
        var vectors = modelServiceClient.embedBatch(texts);
        if (vectors.size() != payloads.size()) {
            throw new IllegalStateException("embed vectors size mismatch");
        }

        // 1) Qdrant upsert
        var pointsBody = objectMapper.createObjectNode();
        var points = pointsBody.putArray("points");
        for (int i = 0; i < payloads.size(); i++) {
            var payload = payloads.get(i);
            var chunkId = payload.get("chunk_id").asText();
            var point = objectMapper.createObjectNode();
            point.put("id", uuid5Url(chunkId));
            var vecArr = point.putArray("vector");
            for (var v : vectors.get(i)) {
                vecArr.add(v);
            }
            point.set("payload", payload);
            points.add(point);
        }
        qdrantClient.upsertPoints(pointsBody);

        // 2) ES bulk index (NDJSON)
        var indexName = elasticsearchClient.indexName();
        var sb = new StringBuilder();
        for (var payload : payloads) {
            var chunkId = payload.get("chunk_id").asText();
            var action = Map.of(
                    "index", Map.of(
                            "_index", indexName,
                            "_id", chunkId
                    )
            );
            sb.append(objectMapper.writeValueAsString(action)).append("\n");
            sb.append(objectMapper.writeValueAsString(payload)).append("\n");
        }
        elasticsearchClient.bulkIndexNdjson(sb.toString());
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) return node.asText();
        return node.asText(null);
    }

    private static String uuid5Url(String name) throws Exception {
        UUID namespace = UUID.fromString("6ba7b811-9dad-11d1-80b4-00c04fd430c8");
        byte[] nsBytes = toBytes(namespace);
        byte[] nameBytes = name.getBytes(StandardCharsets.UTF_8);
        byte[] toHash = new byte[nsBytes.length + nameBytes.length];
        System.arraycopy(nsBytes, 0, toHash, 0, nsBytes.length);
        System.arraycopy(nameBytes, 0, toHash, nsBytes.length, nameBytes.length);
        MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
        byte[] hash = sha1.digest(toHash);
        hash[6] &= 0x0f;
        hash[6] |= 0x50;
        hash[8] &= 0x3f;
        hash[8] |= 0x80;
        long msb = 0;
        long lsb = 0;
        for (int i = 0; i < 8; i++) {
            msb = (msb << 8) | (hash[i] & 0xff);
        }
        for (int i = 8; i < 16; i++) {
            lsb = (lsb << 8) | (hash[i] & 0xff);
        }
        return new UUID(msb, lsb).toString();
    }

    private static byte[] toBytes(UUID uuid) {
        byte[] out = new byte[16];
        long msb = uuid.getMostSignificantBits();
        long lsb = uuid.getLeastSignificantBits();
        for (int i = 0; i < 8; i++) {
            out[i] = (byte) (msb >>> (8 * (7 - i)));
        }
        for (int i = 8; i < 16; i++) {
            out[i] = (byte) (lsb >>> (8 * (15 - i)));
        }
        return out;
    }
}
