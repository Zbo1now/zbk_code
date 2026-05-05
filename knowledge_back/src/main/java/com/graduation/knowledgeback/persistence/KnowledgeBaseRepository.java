package com.graduation.knowledgeback.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBaseEntity, Long> {
    Optional<KnowledgeBaseEntity> findByCode(String code);
}
