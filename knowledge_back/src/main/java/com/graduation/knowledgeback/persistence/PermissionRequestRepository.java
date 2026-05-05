package com.graduation.knowledgeback.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PermissionRequestRepository extends JpaRepository<PermissionRequestEntity, Long> {
    List<PermissionRequestEntity> findByUserIdOrderByCreatedAtDesc(Long userId);
}
