package com.graduation.knowledgeback.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.config.AppProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

@Component
public class LlmClient {
    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final AppProperties.Llm props;

    public LlmClient(WebClient.Builder builder, ObjectMapper objectMapper, AppProperties appProperties) {
        this.webClient = builder.baseUrl(appProperties.llm().baseUrl()).build();
        this.objectMapper = objectMapper;
        this.props = appProperties.llm();
    }

    public String chat(String systemPrompt, String userPrompt) {
        if (props.apiKey() == null || props.apiKey().isBlank()) {
            throw new IllegalStateException("DEEPSEEK_API_KEY is not configured");
        }

        var body = objectMapper.createObjectNode();
        body.put("model", props.model());
        var messages = body.putArray("messages");
        var system = objectMapper.createObjectNode();
        system.put("role", "system");
        system.put("content", systemPrompt);
        messages.add(system);
        var user = objectMapper.createObjectNode();
        user.put("role", "user");
        user.put("content", userPrompt);
        messages.add(user);
        body.put("temperature", 0.2);

        JsonNode resp = webClient.post()
                .uri("/chat/completions")
                .header("Authorization", "Bearer " + props.apiKey())
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(30));

        if (resp == null || resp.get("choices") == null || !resp.get("choices").isArray()) {
            throw new IllegalStateException("LLM response missing choices");
        }
        var first = resp.get("choices").get(0);
        if (first == null || first.get("message") == null) {
            throw new IllegalStateException("LLM response missing message");
        }
        var content = first.get("message").get("content");
        return content == null ? "" : content.asText("");
    }
}
