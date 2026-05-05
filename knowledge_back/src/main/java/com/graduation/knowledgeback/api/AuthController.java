package com.graduation.knowledgeback.api;

import com.graduation.knowledgeback.api.dto.AdminPermissionGrantResponse;
import com.graduation.knowledgeback.api.dto.AdminPermissionResponse;
import com.graduation.knowledgeback.api.dto.AdminPermissionReviewRequest;
import com.graduation.knowledgeback.api.dto.AdminPermissionRequestResponse;
import com.graduation.knowledgeback.api.dto.AdminRoleResponse;
import com.graduation.knowledgeback.api.dto.AdminGrantCreateRequest;
import com.graduation.knowledgeback.api.dto.AdminUserResponse;
import com.graduation.knowledgeback.api.dto.AdminUserRoleUpdateRequest;
import com.graduation.knowledgeback.api.dto.AuthLoginRequest;
import com.graduation.knowledgeback.api.dto.AuthLoginResponse;
import com.graduation.knowledgeback.api.dto.AuthMeResponse;
import com.graduation.knowledgeback.api.dto.AuthRegisterRequest;
import com.graduation.knowledgeback.api.dto.UserPermissionRequestCreateRequest;
import com.graduation.knowledgeback.service.AuthService;
import com.graduation.knowledgeback.service.PermissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth", description = "登录、注册与角色权限管理")
public class AuthController {
    private final AuthService authService;
    private final PermissionService permissionService;

    public AuthController(AuthService authService, PermissionService permissionService) {
        this.authService = authService;
        this.permissionService = permissionService;
    }

    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "返回 bearer token 和当前用户权限信息")
    public AuthLoginResponse login(@Valid @RequestBody AuthLoginRequest request) {
        return authService.login(request.username(), request.password());
    }

    @PostMapping("/register")
    @Operation(summary = "用户注册", description = "创建普通用户账号")
    public AuthMeResponse register(@Valid @RequestBody AuthRegisterRequest request) {
        return authService.register(
                request.username(),
                request.displayName(),
                request.email(),
                request.password()
        );
    }

    @GetMapping("/me")
    @Operation(summary = "当前用户", description = "返回当前登录用户的角色和权限信息")
    public AuthMeResponse me() {
        permissionService.requireAuthenticated();
        return authService.me();
    }

    @GetMapping("/permission-requests/my")
    @Operation(summary = "我的权限申请", description = "返回当前登录用户提交过的权限申请记录")
    public List<AdminPermissionRequestResponse> listMyPermissionRequests() {
        permissionService.requireAuthenticated();
        return authService.listMyPermissionRequests();
    }

    @PostMapping("/permission-requests")
    @Operation(summary = "提交权限申请", description = "当前用户提交一条新的权限申请")
    public AdminPermissionRequestResponse createPermissionRequest(@Valid @RequestBody UserPermissionRequestCreateRequest request) {
        permissionService.requireAuthenticated();
        return authService.createPermissionRequest(
                request.permissionCode(),
                request.resourceType(),
                request.resourceId(),
                request.reason()
        );
    }

    @GetMapping("/admin/users")
    @Operation(summary = "用户列表", description = "角色管理使用的用户列表")
    public List<AdminUserResponse> listUsers() {
        permissionService.requirePermission("role.manage");
        return authService.listUsers();
    }

    @GetMapping("/admin/roles")
    @Operation(summary = "角色列表", description = "角色管理使用的角色与权限列表")
    public List<AdminRoleResponse> listRoles() {
        permissionService.requirePermission("role.manage");
        return authService.listRoles();
    }

    @GetMapping("/admin/permissions")
    @Operation(summary = "权限列表", description = "角色管理使用的权限字典")
    public List<AdminPermissionResponse> listPermissions() {
        permissionService.requirePermission("role.manage");
        return authService.listPermissions();
    }

    @GetMapping("/admin/permission-requests")
    @Operation(summary = "权限申请列表", description = "角色管理查看权限申请记录")
    public List<AdminPermissionRequestResponse> listPermissionRequests() {
        permissionService.requirePermission("role.manage");
        return authService.listPermissionRequests();
    }

    @GetMapping("/admin/permission-grants")
    @Operation(summary = "用户授权列表", description = "角色管理查看当前已生效授权")
    public List<AdminPermissionGrantResponse> listPermissionGrants() {
        permissionService.requirePermission("role.manage");
        return authService.listPermissionGrants();
    }

    @PostMapping("/admin/permission-requests/{requestId}/review")
    @Operation(summary = "审批权限申请", description = "管理员审批通过或拒绝权限申请")
    public AdminPermissionRequestResponse reviewPermissionRequest(
            @PathVariable Long requestId,
            @Valid @RequestBody AdminPermissionReviewRequest request
    ) {
        permissionService.requirePermission("role.manage");
        return authService.reviewPermissionRequest(
                requestId,
                request.action(),
                request.reviewComment(),
                request.effectiveTo()
        );
    }

    @PostMapping("/admin/permission-grants")
    @Operation(summary = "新增用户授权", description = "管理员手工为用户增加一条授权")
    public AdminPermissionGrantResponse createGrant(@Valid @RequestBody AdminGrantCreateRequest request) {
        permissionService.requirePermission("role.manage");
        return authService.createGrant(
                request.userId(),
                request.permissionCode(),
                request.resourceType(),
                request.resourceId(),
                request.effectiveTo()
        );
    }

    @PostMapping("/admin/users/{userId}/roles")
    @Operation(summary = "为用户分配角色", description = "管理员为用户增加一个角色")
    public AdminUserResponse assignRole(
            @PathVariable Long userId,
            @Valid @RequestBody AdminUserRoleUpdateRequest request
    ) {
        permissionService.requirePermission("role.manage");
        return authService.assignRole(userId, request.roleCode());
    }

    @DeleteMapping("/admin/users/{userId}/roles/{roleCode}")
    @Operation(summary = "移除用户角色", description = "管理员移除用户的某个角色")
    public AdminUserResponse removeRole(@PathVariable Long userId, @PathVariable String roleCode) {
        permissionService.requirePermission("role.manage");
        return authService.removeRole(userId, roleCode);
    }

    @PostMapping("/admin/permission-grants/{grantId}/revoke")
    @Operation(summary = "撤销用户授权", description = "管理员撤销一条已存在的授权")
    public AdminPermissionGrantResponse revokeGrant(@PathVariable Long grantId) {
        permissionService.requirePermission("role.manage");
        return authService.revokeGrant(grantId);
    }
}
