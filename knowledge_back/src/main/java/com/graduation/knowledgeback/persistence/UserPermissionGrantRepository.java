package com.graduation.knowledgeback.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserPermissionGrantRepository extends JpaRepository<UserPermissionGrantEntity, Long> {
    List<UserPermissionGrantEntity> findByUserIdAndStatus(Long userId, String status);
    List<UserPermissionGrantEntity> findByUserId(Long userId);
}
