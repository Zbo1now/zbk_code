package com.graduation.knowledgeback.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graduation.knowledgeback.config.AppProperties;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

@Service
public class AuthTokenService {
    private final ObjectMapper objectMapper;
    private final String tokenSecret;
    private final long tokenTtlSeconds;

    public AuthTokenService(ObjectMapper objectMapper, AppProperties appProperties) {
        this.objectMapper = objectMapper;
        this.tokenSecret = appProperties.auth() != null && appProperties.auth().tokenSecret() != null
                ? appProperties.auth().tokenSecret()
                : "change-this-secret-in-production";
        this.tokenTtlSeconds = appProperties.auth() != null && appProperties.auth().tokenTtlSeconds() != null
                ? appProperties.auth().tokenTtlSeconds()
                : 43_200L;
    }

    public String issueToken(Long userId, String username, String role) {
        try {
            long now = Instant.now().getEpochSecond();
            long exp = now + tokenTtlSeconds;
            String payload = objectMapper.createObjectNode()
                    .put("sub", userId)
                    .put("username", username)
                    .put("role", role)
                    .put("iat", now)
                    .put("exp", exp)
                    .toString();
            String payloadPart = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
            String signaturePart = sign(payloadPart);
            return payloadPart + "." + signaturePart;
        } catch (Exception e) {
            throw new IllegalStateException("生成登录令牌失败", e);
        }
    }

    public TokenPrincipal parseToken(String token) {
        if (token == null || token.isBlank()) {
            throw new UnauthorizedException("缺少登录令牌");
        }
        int dot = token.lastIndexOf('.');
        if (dot <= 0 || dot >= token.length() - 1) {
            throw new UnauthorizedException("登录令牌格式无效");
        }

        String payloadPart = token.substring(0, dot);
        String signaturePart = token.substring(dot + 1);
        if (!sign(payloadPart).equals(signaturePart)) {
            throw new UnauthorizedException("登录令牌签名无效");
        }

        try {
            byte[] decoded = Base64.getUrlDecoder().decode(payloadPart);
            JsonNode payload = objectMapper.readTree(decoded);
            long exp = payload.path("exp").asLong(0L);
            if (exp <= Instant.now().getEpochSecond()) {
                throw new UnauthorizedException("登录令牌已过期");
            }
            return new TokenPrincipal(
                    payload.path("sub").asLong(),
                    payload.path("username").asText(""),
                    payload.path("role").asText("USER")
            );
        } catch (UnauthorizedException e) {
            throw e;
        } catch (Exception e) {
            throw new UnauthorizedException("登录令牌解析失败");
        }
    }

    private String sign(String payloadPart) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(tokenSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(payloadPart.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException("登录令牌签名失败", e);
        }
    }

    public record TokenPrincipal(Long userId, String username, String role) {
    }
}
