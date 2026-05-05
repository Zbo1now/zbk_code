package com.graduation.knowledgeback.config;

import com.graduation.knowledgeback.service.AuthContextHolder;
import com.graduation.knowledgeback.service.AuthService;
import com.graduation.knowledgeback.service.AuthTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {
    private final AuthTokenService authTokenService;
    private final AuthService authService;

    public AuthInterceptor(AuthTokenService authTokenService, AuthService authService) {
        this.authTokenService = authTokenService;
        this.authService = authService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring("Bearer ".length()).trim();
            var principal = authTokenService.parseToken(token);
            AuthContextHolder.set(authService.loadAuthenticatedUser(principal.userId()));
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        AuthContextHolder.clear();
    }
}
