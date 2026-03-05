package com.graduation.knowledgeback.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.tika.Tika;
import org.apache.tika.metadata.Metadata;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ParsingService {

    private final Tika tika;
    private final ObjectMapper objectMapper;
        private static final int CHUNK_SIZE = 500;
        private static final double CHUNK_OVERLAP_RATIO = 0.15;
        private static final java.util.regex.Pattern HEADING_PATTERN =
            java.util.regex.Pattern.compile("^\\s*\\d+(?:\\.\\d+)+\\s+.+");

    public ParsingService(ObjectMapper objectMapper) {
        this.tika = new Tika(); // Tika auto-detects parser configuration
        // Increase string limit for large PDFs
        this.tika.setMaxStringLength(10 * 1024 * 1024); 
        this.objectMapper = objectMapper;
    }

    public String parse(Path path) throws Exception {
        Metadata metadata = new Metadata();
        try (InputStream stream = java.nio.file.Files.newInputStream(path)) {
            return tika.parseToString(stream, metadata);
        }
    }

    public List<com.fasterxml.jackson.databind.JsonNode> chunkDocument(String docId, String content, String title, String source) {
        List<String> chunks = splitText(content, CHUNK_SIZE, (int) Math.max(1, Math.round(CHUNK_SIZE * CHUNK_OVERLAP_RATIO)));
        List<com.fasterxml.jackson.databind.JsonNode> jsonChunks = new ArrayList<>();

        for (int i = 0; i < chunks.size(); i++) {
            String chunkText = chunks.get(i);
            ObjectNode node = objectMapper.createObjectNode();
            
            String chunkId = docId + "_chunk_" + i;
            node.put("doc_id", docId);
            node.put("chunk_id", chunkId);
            node.put("content", chunkText);
            node.put("title", title);
            node.put("source", source);
            node.put("chunk_index", i);
            
            jsonChunks.add(node);
        }
        return jsonChunks;
    }

    /**
     * Simple sliding window splitter.
     * In a real production system, use a smarter splitter (e.g. sentence aware, LangChain RecursiveCharacterTextSplitter).
     */
    private List<String> splitText(String text, int targetSize, int overlap) {
        List<String> result = new ArrayList<>();
        if (text == null || text.isBlank()) return result;
        var sections = splitByHeadings(text);
        for (var section : sections) {
            result.addAll(splitSection(section, targetSize, overlap));
        }
        return result;
    }

    private List<String> splitByHeadings(String text) {
        List<String> sections = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        String[] lines = text.split("\\r?\\n");
        for (String line : lines) {
            if (HEADING_PATTERN.matcher(line).matches()) {
                if (!current.isEmpty()) {
                    sections.add(current.toString().trim());
                    current.setLength(0);
                }
            }
            if (!line.isBlank() || !current.isEmpty()) {
                current.append(line).append("\n");
            }
        }
        if (!current.isEmpty()) {
            sections.add(current.toString().trim());
        }
        return sections;
    }

    private List<String> splitSection(String section, int targetSize, int overlap) {
        List<String> result = new ArrayList<>();
        if (section == null || section.isBlank()) return result;

        String heading = null;
        String body = section;
        String[] lines = section.split("\\r?\\n", 2);
        if (lines.length > 0 && HEADING_PATTERN.matcher(lines[0]).matches()) {
            heading = lines[0].trim();
            body = lines.length > 1 ? lines[1] : "";
        }

        int len = body.length();
        int start = 0;
        while (start < len) {
            int end = Math.min(start + targetSize, len);
            if (end < len) {
                int lastSpace = body.lastIndexOf(' ', end);
                int lastPeriod = body.lastIndexOf('.', end);
                int lastNewLine = body.lastIndexOf('\n', end);
                int breakPoint = Math.max(lastNewLine, Math.max(lastPeriod, lastSpace));
                if (breakPoint > start + (targetSize * 0.8)) {
                    end = breakPoint + 1;
                }
            }
            String chunkBody = body.substring(start, end).trim();
            if (!chunkBody.isEmpty()) {
                String chunk = heading != null ? (heading + "\n" + chunkBody) : chunkBody;
                result.add(chunk);
            }
            start += (targetSize - overlap);
            if (start >= end) {
                start = end;
            }
        }
        return result;
    }
}
