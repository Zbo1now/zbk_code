package com.graduation.knowledgeback.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SearchLogRepository extends JpaRepository<SearchLogEntity, String> {
    List<SearchLogEntity> findAllByOrderByCreatedAtDesc();
}
