package com.graduation.knowledgeback.service;

import com.graduation.knowledgeback.api.dto.AdminRoleResponse;
import com.graduation.knowledgeback.api.dto.AdminUserResponse;
import com.graduation.knowledgeback.api.dto.AdminPermissionGrantResponse;
import com.graduation.knowledgeback.api.dto.AdminPermissionResponse;
import com.graduation.knowledgeback.api.dto.AdminPermissionRequestResponse;
import com.graduation.knowledgeback.api.dto.AuthLoginResponse;
import com.graduation.knowledgeback.api.dto.AuthMeResponse;
import com.graduation.knowledgeback.persistence.PermissionEntity;
import com.graduation.knowledgeback.persistence.PermissionRequestEntity;
import com.graduation.knowledgeback.persistence.PermissionRepository;
import com.graduation.knowledgeback.persistence.RoleEntity;
import com.graduation.knowledgeback.persistence.RolePermissionRepository;
import com.graduation.knowledgeback.persistence.RoleRepository;
import com.graduation.knowledgeback.persistence.UserEntity;
import com.graduation.knowledgeback.persistence.UserPermissionGrantEntity;
import com.graduation.knowledgeback.persistence.UserRepository;
import com.graduation.knowledgeback.persistence.UserRoleEntity;
import com.graduation.knowledgeback.persistence.UserRoleRepository;
import com.graduation.knowledgeback.persistence.PermissionRequestRepository;
import com.graduation.knowledgeback.persistence.UserPermissionGrantRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AuthService {
    private static final Set<String> USER_SELF_SERVICE_PERMISSION_CODES = Set.of("kb.upload", "kb.view");

    private final UserRepository userRepository;
    private final PasswordService passwordService;
    private final AuthTokenService authTokenService;
    private final PermissionService permissionService;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionRepository permissionRepository;
    private final PermissionRequestRepository permissionRequestRepository;
    private final UserPermissionGrantRepository userPermissionGrantRepository;

    public AuthService(
            UserRepository userRepository,
            PasswordService passwordService,
            AuthTokenService authTokenService,
            PermissionService permissionService,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            RolePermissionRepository rolePermissionRepository,
            PermissionRepository permissionRepository,
            PermissionRequestRepository permissionRequestRepository,
            UserPermissionGrantRepository userPermissionGrantRepository
    ) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
        this.authTokenService = authTokenService;
        this.permissionService = permissionService;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.permissionRepository = permissionRepository;
        this.permissionRequestRepository = permissionRequestRepository;
        this.userPermissionGrantRepository = userPermissionGrantRepository;
    }

    public AuthLoginResponse login(String username, String password) {
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UnauthorizedException("用户名或密码错误"));

        if (!user.isEnabled()) {
            throw new ForbiddenException("当前账号已被禁用");
        }
        if (!passwordService.matchesAndUpgrade(user, password)) {
            throw new UnauthorizedException("用户名或密码错误");
        }

        user.setLastLogin(Instant.now());
        userRepository.save(user);

        AuthenticatedUser authenticatedUser = permissionService.buildAuthenticatedUser(user);
        String primaryRole = authenticatedUser.roleCodes().stream()
                .sorted(Comparator.comparing(role -> "ADMIN".equals(role) ? 0 : 1))
                .findFirst()
                .orElse("USER");

        return new AuthLoginResponse(
                authTokenService.issueToken(user.getUserId(), user.getUsername(), primaryRole),
                toMeResponse(authenticatedUser)
        );
    }

    public AuthMeResponse register(String username, String displayName, String email, String password) {
        if (userRepository.findByUsername(username.trim()).isPresent()) {
            throw new IllegalArgumentException("用户名已存在");
        }

        UserEntity user = new UserEntity();
        user.setUsername(username.trim());
        user.setDisplayName(displayName == null || displayName.isBlank() ? username.trim() : displayName.trim());
        user.setEmail(email == null || email.isBlank() ? null : email.trim());
        user.setPasswordHash(passwordService.encode(password));
        user.setRole("USER");
        user.setEnabled(true);
        user.setCreatedAt(Instant.now());
        UserEntity saved = userRepository.save(user);

        RoleEntity userRole = roleRepository.findByCode("USER")
                .orElseThrow(() -> new IllegalStateException("默认 USER 角色不存在"));
        UserRoleEntity relation = new UserRoleEntity();
        relation.setUserId(saved.getUserId());
        relation.setRoleId(userRole.getId());
        relation.setAssignedAt(Instant.now());
        userRoleRepository.save(relation);

        return toMeResponse(permissionService.buildAuthenticatedUser(saved));
    }

    public AuthenticatedUser loadAuthenticatedUser(Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("登录用户不存在"));
        return permissionService.buildAuthenticatedUser(user);
    }

    public AuthMeResponse me() {
        return toMeResponse(AuthContextHolder.require());
    }

    public List<AdminUserResponse> listUsers() {
        return userRepository.findAll().stream()
                .map(user -> {
                    AuthenticatedUser authUser = permissionService.buildAuthenticatedUser(user);
                    return new AdminUserResponse(
                            user.getUserId(),
                            user.getUsername(),
                            user.getDisplayName(),
                            user.getEmail(),
                            user.getDepartment(),
                            user.isEnabled(),
                            authUser.roleCodes().stream().sorted().toList(),
                            authUser.permissions().stream().sorted().toList()
                    );
                })
                .sorted(Comparator.comparing(AdminUserResponse::userId))
                .toList();
    }

    public List<AdminPermissionRequestResponse> listMyPermissionRequests() {
        Long userId = AuthContextHolder.require().userId();
        return permissionRequestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(entity -> new AdminPermissionRequestResponse(
                        entity.getId(),
                        entity.getUserId(),
                        entity.getPermissionCode(),
                        entity.getResourceType(),
                        entity.getResourceId(),
                        entity.getReason(),
                        entity.getStatus(),
                        entity.getReviewerId(),
                        entity.getReviewComment(),
                        entity.getCreatedAt(),
                        entity.getReviewedAt()
                ))
                .toList();
    }

    public AdminPermissionRequestResponse createPermissionRequest(String permissionCode, String resourceType, String resourceId, String reason) {
        AuthenticatedUser currentUser = AuthContextHolder.require();
        String normalizedPermissionCode = permissionCode == null ? "" : permissionCode.trim();
        String normalizedResourceType = resourceType == null ? "" : resourceType.trim().toUpperCase();
        String normalizedResourceId = resourceId == null || resourceId.isBlank() ? null : resourceId.trim();
        String normalizedReason = reason == null || reason.isBlank() ? null : reason.trim();

        if (normalizedPermissionCode.isBlank() || normalizedResourceType.isBlank()) {
            throw new IllegalArgumentException("权限编码和资源类型不能为空");
        }
        permissionRepository.findByCode(normalizedPermissionCode)
                .orElseThrow(() -> new IllegalArgumentException("申请的权限不存在"));
        if (!USER_SELF_SERVICE_PERMISSION_CODES.contains(normalizedPermissionCode)) {
            throw new IllegalArgumentException("当前仅支持申请知识库查看和上传相关权限");
        }

        if (permissionService.hasPermission(currentUser, normalizedPermissionCode, normalizedResourceType, normalizedResourceId)) {
            throw new IllegalArgumentException("当前用户已经拥有该权限，无需重复申请");
        }

        boolean hasPending = permissionRequestRepository.findByUserIdOrderByCreatedAtDesc(currentUser.userId()).stream()
                .anyMatch(item ->
                        "PENDING".equalsIgnoreCase(item.getStatus())
                                && normalizedPermissionCode.equalsIgnoreCase(item.getPermissionCode())
                                && normalizedResourceType.equalsIgnoreCase(item.getResourceType())
                                && Objects.equals(normalizedResourceId, item.getResourceId())
                );
        if (hasPending) {
            throw new IllegalArgumentException("相同权限申请正在审批中，请勿重复提交");
        }

        PermissionRequestEntity entity = new PermissionRequestEntity();
        entity.setUserId(currentUser.userId());
        entity.setPermissionCode(normalizedPermissionCode);
        entity.setResourceType(normalizedResourceType);
        entity.setResourceId(normalizedResourceId);
        entity.setReason(normalizedReason);
        entity.setStatus("PENDING");
        entity.setCreatedAt(Instant.now());
        PermissionRequestEntity saved = permissionRequestRepository.save(entity);

        return new AdminPermissionRequestResponse(
                saved.getId(),
                saved.getUserId(),
                saved.getPermissionCode(),
                saved.getResourceType(),
                saved.getResourceId(),
                saved.getReason(),
                saved.getStatus(),
                saved.getReviewerId(),
                saved.getReviewComment(),
                saved.getCreatedAt(),
                saved.getReviewedAt()
        );
    }

    public List<AdminRoleResponse> listRoles() {
        List<RoleEntity> roles = roleRepository.findAll();
        Map<Long, List<Long>> permissionIdsByRole = rolePermissionRepository.findAll().stream()
                .collect(Collectors.groupingBy(
                        rolePermission -> rolePermission.getRoleId(),
                        Collectors.mapping(rolePermission -> rolePermission.getPermissionId(), Collectors.toList())
                ));
        Set<Long> permissionIds = permissionIdsByRole.values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toSet());
        Map<Long, PermissionEntity> permissionMap = permissionRepository.findAllById(permissionIds).stream()
                .collect(Collectors.toMap(PermissionEntity::getId, permission -> permission));

        return roles.stream()
                .map(role -> new AdminRoleResponse(
                        role.getId(),
                        role.getCode(),
                        role.getName(),
                        role.getDescription(),
                        role.isSystemRole(),
                        permissionIdsByRole.getOrDefault(role.getId(), List.of()).stream()
                                .map(permissionMap::get)
                                .filter(Objects::nonNull)
                                .map(PermissionEntity::getCode)
                                .sorted()
                                .toList()
                ))
                .sorted(Comparator.comparing(AdminRoleResponse::id))
                .toList();
    }

    public List<AdminPermissionRequestResponse> listPermissionRequests() {
        return permissionRequestRepository.findAll().stream()
                .map(entity -> new AdminPermissionRequestResponse(
                        entity.getId(),
                        entity.getUserId(),
                        entity.getPermissionCode(),
                        entity.getResourceType(),
                        entity.getResourceId(),
                        entity.getReason(),
                        entity.getStatus(),
                        entity.getReviewerId(),
                        entity.getReviewComment(),
                        entity.getCreatedAt(),
                        entity.getReviewedAt()
                ))
                .sorted(Comparator.comparing(AdminPermissionRequestResponse::createdAt).reversed())
                .toList();
    }

    public List<AdminPermissionGrantResponse> listPermissionGrants() {
        return userPermissionGrantRepository.findAll().stream()
                .map(entity -> new AdminPermissionGrantResponse(
                        entity.getId(),
                        entity.getUserId(),
                        entity.getPermissionCode(),
                        entity.getResourceType(),
                        entity.getResourceId(),
                        entity.getGrantedBy(),
                        entity.getSourceRequestId(),
                        entity.getStatus(),
                        entity.getEffectiveFrom(),
                        entity.getEffectiveTo(),
                        entity.getCreatedAt()
                ))
                .sorted(Comparator.comparing(AdminPermissionGrantResponse::createdAt).reversed())
                .toList();
    }

    public List<AdminPermissionResponse> listPermissions() {
        return permissionRepository.findAll().stream()
                .map(entity -> new AdminPermissionResponse(
                        entity.getId(),
                        entity.getCode(),
                        entity.getName(),
                        entity.getModule(),
                        entity.getDescription()
                ))
                .sorted(Comparator.comparing(AdminPermissionResponse::module).thenComparing(AdminPermissionResponse::code))
                .toList();
    }

    public AdminPermissionRequestResponse reviewPermissionRequest(Long requestId, String action, String reviewComment, String effectiveTo) {
        PermissionRequestEntity request = permissionRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("权限申请不存在"));
        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalArgumentException("该申请已处理，不能重复审批");
        }

        Long operatorId = AuthContextHolder.require().userId();
        request.setReviewerId(operatorId);
        request.setReviewComment(reviewComment);
        request.setReviewedAt(Instant.now());

        if ("APPROVE".equalsIgnoreCase(action)) {
            request.setStatus("APPROVED");
            UserPermissionGrantEntity grant = new UserPermissionGrantEntity();
            grant.setUserId(request.getUserId());
            grant.setPermissionCode(request.getPermissionCode());
            grant.setResourceType(request.getResourceType());
            grant.setResourceId(request.getResourceId());
            grant.setGrantedBy(operatorId);
            grant.setSourceRequestId(request.getId());
            grant.setStatus("ACTIVE");
            grant.setEffectiveFrom(Instant.now());
            grant.setEffectiveTo(parseInstantOrNull(effectiveTo));
            grant.setCreatedAt(Instant.now());
            userPermissionGrantRepository.save(grant);
        } else if ("REJECT".equalsIgnoreCase(action)) {
            request.setStatus("REJECTED");
        } else {
            throw new IllegalArgumentException("不支持的审批动作");
        }

        PermissionRequestEntity saved = permissionRequestRepository.save(request);
        return new AdminPermissionRequestResponse(
                saved.getId(),
                saved.getUserId(),
                saved.getPermissionCode(),
                saved.getResourceType(),
                saved.getResourceId(),
                saved.getReason(),
                saved.getStatus(),
                saved.getReviewerId(),
                saved.getReviewComment(),
                saved.getCreatedAt(),
                saved.getReviewedAt()
        );
    }

    public AdminPermissionGrantResponse createGrant(Long userId, String permissionCode, String resourceType, String resourceId, String effectiveTo) {
        userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        permissionRepository.findByCode(permissionCode).orElseThrow(() -> new IllegalArgumentException("权限不存在"));

        UserPermissionGrantEntity grant = new UserPermissionGrantEntity();
        grant.setUserId(userId);
        grant.setPermissionCode(permissionCode);
        grant.setResourceType(resourceType);
        grant.setResourceId(resourceId == null || resourceId.isBlank() ? null : resourceId.trim());
        grant.setGrantedBy(AuthContextHolder.require().userId());
        grant.setStatus("ACTIVE");
        grant.setEffectiveFrom(Instant.now());
        grant.setEffectiveTo(parseInstantOrNull(effectiveTo));
        grant.setCreatedAt(Instant.now());
        UserPermissionGrantEntity saved = userPermissionGrantRepository.save(grant);
        return toGrantResponse(saved);
    }

    public AdminPermissionGrantResponse revokeGrant(Long grantId) {
        UserPermissionGrantEntity grant = userPermissionGrantRepository.findById(grantId)
                .orElseThrow(() -> new IllegalArgumentException("授权记录不存在"));
        grant.setStatus("REVOKED");
        if (grant.getEffectiveTo() == null || grant.getEffectiveTo().isAfter(Instant.now())) {
            grant.setEffectiveTo(Instant.now());
        }
        UserPermissionGrantEntity saved = userPermissionGrantRepository.save(grant);
        return toGrantResponse(saved);
    }

    public AdminUserResponse assignRole(Long userId, String roleCode) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        RoleEntity role = roleRepository.findByCode(roleCode.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("角色不存在"));

        if (!userRoleRepository.existsByUserIdAndRoleId(userId, role.getId())) {
            UserRoleEntity relation = new UserRoleEntity();
            relation.setUserId(userId);
            relation.setRoleId(role.getId());
            relation.setAssignedBy(AuthContextHolder.require().userId());
            relation.setAssignedAt(Instant.now());
            userRoleRepository.save(relation);
        }
        return toAdminUserResponse(userRepository.findById(user.getUserId()).orElseThrow());
    }

    public AdminUserResponse removeRole(Long userId, String roleCode) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        RoleEntity role = roleRepository.findByCode(roleCode.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("角色不存在"));
        userRoleRepository.deleteByUserIdAndRoleId(userId, role.getId());
        return toAdminUserResponse(userRepository.findById(user.getUserId()).orElseThrow());
    }

    public AuthMeResponse toMeResponse(AuthenticatedUser user) {
        return new AuthMeResponse(
                user.userId(),
                user.username(),
                user.displayName(),
                user.enabled(),
                user.roleCodes().stream().sorted().toList(),
                user.permissions().stream().sorted().toList()
        );
    }

    private AdminUserResponse toAdminUserResponse(UserEntity user) {
        AuthenticatedUser authUser = permissionService.buildAuthenticatedUser(user);
        return new AdminUserResponse(
                user.getUserId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getEmail(),
                user.getDepartment(),
                user.isEnabled(),
                authUser.roleCodes().stream().sorted().toList(),
                authUser.permissions().stream().sorted().toList()
        );
    }

    private AdminPermissionGrantResponse toGrantResponse(UserPermissionGrantEntity entity) {
        return new AdminPermissionGrantResponse(
                entity.getId(),
                entity.getUserId(),
                entity.getPermissionCode(),
                entity.getResourceType(),
                entity.getResourceId(),
                entity.getGrantedBy(),
                entity.getSourceRequestId(),
                entity.getStatus(),
                entity.getEffectiveFrom(),
                entity.getEffectiveTo(),
                entity.getCreatedAt()
        );
    }

    private Instant parseInstantOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return OffsetDateTime.parse(value).toInstant();
    }
}
