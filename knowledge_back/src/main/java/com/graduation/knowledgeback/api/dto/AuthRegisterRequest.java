package com.graduation.knowledgeback.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthRegisterRequest(
        @NotBlank(message = "用户名不能为空")
        @Size(min = 3, max = 64, message = "用户名长度需在 3 到 64 个字符之间")
        String username,
        @NotBlank(message = "显示名称不能为空")
        @Size(max = 100, message = "显示名称不能超过 100 个字符")
        String displayName,
        @Email(message = "邮箱格式不正确")
        @Size(max = 100, message = "邮箱长度不能超过 100 个字符")
        String email,
        @NotBlank(message = "密码不能为空")
        @Size(min = 6, max = 100, message = "密码长度至少 6 位")
        String password
) {
}
