package com.graduation.knowledgeback.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.tika.Tika;
import org.apache.tika.metadata.Metadata;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class ParsingService {
    private static final int DEFAULT_CHUNK_SIZE = 500;
    private static final int DEFAULT_CHUNK_OVERLAP = 75;
    private static final int MIN_CHUNK_SIZE = 100;
    private static final int MAX_CHUNK_SIZE = 2000;
    private static final int MIN_OVERLAP = 0;
    private static final Pattern HEADING_PATTERN = Pattern.compile("^\\s*\\d+(?:\\.\\d+)+\\s+.+");

    private final Tika tika;
    private final ObjectMapper objectMapper;

    private volatile int chunkSize = DEFAULT_CHUNK_SIZE;
    private volatile int chunkOverlap = DEFAULT_CHUNK_OVERLAP;

    public ParsingService(ObjectMapper objectMapper) {
        this.tika = new Tika();
        this.tika.setMaxStringLength(10 * 1024 * 1024);
        this.objectMapper = objectMapper;
    }

    public String parse(Path path) throws Exception {
        Metadata metadata = new Metadata();
        try (InputStream stream = Files.newInputStream(path)) {
            return tika.parseToString(stream, metadata);
        }
    }

    public synchronized void updateChunkSettings(int targetSize, int overlap) {
        validateChunkSettings(targetSize, overlap);
        this.chunkSize = targetSize;
        this.chunkOverlap = overlap;
    }

    public int getChunkSize() {
        return chunkSize;
    }

    public int getChunkOverlap() {
        return chunkOverlap;
    }

    public int getDefaultChunkSize() {
        return DEFAULT_CHUNK_SIZE;
    }

    public int getDefaultChunkOverlap() {
        return DEFAULT_CHUNK_OVERLAP;
    }

    public List<JsonNode> chunkDocument(String docId, String content, String title, String source) {
        return chunkDocument(docId, content, title, source, chunkSize, chunkOverlap);
    }

    public List<JsonNode> chunkDocument(String docId, String content, String title, String source, int targetSize, int overlap) {
        validateChunkSettings(targetSize, overlap);
        List<String> chunks = splitText(content, targetSize, overlap);
        List<JsonNode> jsonChunks = new ArrayList<>();

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

    private void validateChunkSettings(int targetSize, int overlap) {
        if (targetSize < MIN_CHUNK_SIZE || targetSize > MAX_CHUNK_SIZE) {
            throw new IllegalArgumentException("targetSize must be between " + MIN_CHUNK_SIZE + " and " + MAX_CHUNK_SIZE);
        }
        if (overlap < MIN_OVERLAP || overlap >= targetSize) {
            throw new IllegalArgumentException("overlap must be >= " + MIN_OVERLAP + " and smaller than targetSize");
        }
    }

    private List<String> splitText(String text, int targetSize, int overlap) {
        List<String> result = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return result;
        }
        List<String> sections = splitByHeadings(text);
        for (String section : sections) {
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
        if (section == null || section.isBlank()) {
            return result;
        }

        String heading = null;
        String body = section;
        String[] lines = section.split("\\r?\\n", 2);
        if (lines.length > 0 && HEADING_PATTERN.matcher(lines[0]).matches()) {
            heading = lines[0].trim();
            body = lines.length > 1 ? lines[1] : "";
        }

        int length = body.length();
        int start = 0;
        while (start < length) {
            int end = Math.min(start + targetSize, length);
            if (end < length) {
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
