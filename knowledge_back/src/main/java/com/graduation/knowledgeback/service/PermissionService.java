package com.graduation.knowledgeback.service;

import com.graduation.knowledgeback.persistence.PermissionEntity;
import com.graduation.knowledgeback.persistence.PermissionRepository;
import com.graduation.knowledgeback.persistence.RoleEntity;
import com.graduation.knowledgeback.persistence.RolePermissionRepository;
import com.graduation.knowledgeback.persistence.RoleRepository;
import com.graduation.knowledgeback.persistence.UserEntity;
import com.graduation.knowledgeback.persistence.UserPermissionGrantEntity;
import com.graduation.knowledgeback.persistence.UserPermissionGrantRepository;
import com.graduation.knowledgeback.persistence.UserRoleRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class PermissionService {
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionRepository permissionRepository;
    private final UserPermissionGrantRepository userPermissionGrantRepository;

    public PermissionService(
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            RolePermissionRepository rolePermissionRepository,
            PermissionRepository permissionRepository,
            UserPermissionGrantRepository userPermissionGrantRepository
    ) {
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.permissionRepository = permissionRepository;
        this.userPermissionGrantRepository = userPermissionGrantRepository;
    }

    public AuthenticatedUser buildAuthenticatedUser(UserEntity user) {
        Set<String> roleCodes = resolveRoleCodes(user);
        Set<String> permissions = new HashSet<>(resolveRolePermissions(roleCodes));
        permissions.addAll(resolveActiveGrantPermissionCodes(user.getUserId()));
        return new AuthenticatedUser(
                user.getUserId(),
                user.getUsername(),
                user.getDisplayName(),
                user.isEnabled(),
                roleCodes,
                permissions
        );
    }

    public void requireAuthenticated() {
        AuthenticatedUser user = AuthContextHolder.require();
        if (!user.enabled()) {
            throw new ForbiddenException("当前账号已被禁用");
        }
    }

    public void requirePermission(String permissionCode) {
        requirePermission(permissionCode, null, null);
    }

    public void requirePermission(String permissionCode, String resourceType, String resourceId) {
        AuthenticatedUser user = AuthContextHolder.require();
        if (!user.enabled()) {
            throw new ForbiddenException("当前账号已被禁用");
        }
        if (hasPermission(user, permissionCode, resourceType, resourceId)) {
            return;
        }
        throw new ForbiddenException("当前账号缺少权限: " + permissionCode);
    }

    public boolean hasPermission(AuthenticatedUser user, String permissionCode, String resourceType, String resourceId) {
        if (user == null || !user.enabled()) {
            return false;
        }
        if (user.isAdmin()) {
            return true;
        }
        if (user.permissions() != null && user.permissions().contains(permissionCode)) {
            return true;
        }

        Instant now = Instant.now();
        List<UserPermissionGrantEntity> grants = userPermissionGrantRepository.findByUserIdAndStatus(user.userId(), "ACTIVE");
        return grants.stream().anyMatch(grant ->
                permissionCode.equalsIgnoreCase(grant.getPermissionCode())
                        && matchesResource(resourceType, resourceId, grant)
                        && !grant.getEffectiveFrom().isAfter(now)
                        && (grant.getEffectiveTo() == null || grant.getEffectiveTo().isAfter(now))
        );
    }

    private boolean matchesResource(String resourceType, String resourceId, UserPermissionGrantEntity grant) {
        if (resourceType == null || resourceType.isBlank()) {
            return true;
        }
        if (!resourceType.equalsIgnoreCase(grant.getResourceType())) {
            return false;
        }
        if (grant.getResourceId() == null || grant.getResourceId().isBlank()) {
            return true;
        }
        return Objects.equals(resourceId, grant.getResourceId());
    }

    private Set<String> resolveRoleCodes(UserEntity user) {
        Set<String> roleCodes = new HashSet<>();
        if (user.getRole() != null && !user.getRole().isBlank()) {
            roleCodes.add(user.getRole().toUpperCase());
        }
        var roleIds = userRoleRepository.findByUserId(user.getUserId()).stream()
                .map(role -> role.getRoleId())
                .collect(Collectors.toSet());
        if (!roleIds.isEmpty()) {
            var roleMap = roleRepository.findAllById(roleIds).stream()
                    .collect(Collectors.toMap(RoleEntity::getId, RoleEntity::getCode));
            roleIds.stream()
                    .map(roleMap::get)
                    .filter(Objects::nonNull)
                    .map(String::toUpperCase)
                    .forEach(roleCodes::add);
        }
        return roleCodes;
    }

    private Set<String> resolveRolePermissions(Set<String> roleCodes) {
        if (roleCodes == null || roleCodes.isEmpty()) {
            return Set.of();
        }
        var roles = roleCodes.stream()
                .map(roleRepository::findByCode)
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .toList();
        var roleIds = roles.stream().map(RoleEntity::getId).toList();
        if (roleIds.isEmpty()) {
            return Set.of();
        }
        var permissionIds = rolePermissionRepository.findByRoleIdIn(roleIds).stream()
                .map(link -> link.getPermissionId())
                .collect(Collectors.toSet());
        if (permissionIds.isEmpty()) {
            return Set.of();
        }
        return permissionRepository.findAllById(permissionIds).stream()
                .map(PermissionEntity::getCode)
                .collect(Collectors.toSet());
    }

    private Set<String> resolveActiveGrantPermissionCodes(Long userId) {
        Instant now = Instant.now();
        return userPermissionGrantRepository.findByUserIdAndStatus(userId, "ACTIVE").stream()
                .filter(grant -> !grant.getEffectiveFrom().isAfter(now))
                .filter(grant -> grant.getEffectiveTo() == null || grant.getEffectiveTo().isAfter(now))
                .map(UserPermissionGrantEntity::getPermissionCode)
                .collect(Collectors.toSet());
    }
}
