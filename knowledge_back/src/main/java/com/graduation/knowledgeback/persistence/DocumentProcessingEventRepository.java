package com.graduation.knowledgeback.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentProcessingEventRepository extends JpaRepository<DocumentProcessingEventEntity, Long> {
    List<DocumentProcessingEventEntity> findByDocIdOrderByCreatedAtAscIdAsc(String docId);
}
