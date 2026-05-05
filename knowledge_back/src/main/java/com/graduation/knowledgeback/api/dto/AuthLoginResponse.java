package com.graduation.knowledgeback.api.dto;

public record AuthLoginResponse(
        String accessToken,
        AuthMeResponse user
) {
}
