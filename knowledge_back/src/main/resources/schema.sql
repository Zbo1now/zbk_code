-- ==============================================================================
-- Database schema for Industrial Knowledge RAG
-- Notes:
-- 1. This file is the source of truth for table structure.
-- 2. The project currently uses `spring.jpa.hibernate.ddl-auto=none`.
-- 3. Running this script will recreate tables because of the DROP statements.
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS knowledge_base
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE knowledge_base;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `user_permission_grants`;
DROP TABLE IF EXISTS `permission_requests`;
DROP TABLE IF EXISTS `knowledge_categories`;
DROP TABLE IF EXISTS `knowledge_bases`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `document_processing_event`;
DROP TABLE IF EXISTS `feedback`;
DROP TABLE IF EXISTS `qa_logs`;
DROP TABLE IF EXISTS `search_logs`;
DROP TABLE IF EXISTS `tasks`;
DROP TABLE IF EXISTS `documents`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `user_id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'USER',
  `display_name` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `department` VARCHAR(100) DEFAULT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_users_username` (`username`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System users';

CREATE TABLE `roles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `system_role` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Role definitions';

CREATE TABLE `permissions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `module` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permissions_code` (`code`),
  KEY `idx_permissions_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Permission definitions';

CREATE TABLE `role_permissions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `role_id` BIGINT NOT NULL,
  `permission_id` BIGINT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permissions` (`role_id`, `permission_id`),
  KEY `idx_role_permissions_permission_id` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Role to permission mappings';

CREATE TABLE `user_roles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `role_id` BIGINT NOT NULL,
  `assigned_by` BIGINT DEFAULT NULL,
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_roles` (`user_id`, `role_id`),
  KEY `idx_user_roles_role_id` (`role_id`),
  KEY `idx_user_roles_assigned_by` (`assigned_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User to role mappings';

CREATE TABLE `knowledge_bases` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `visibility` VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  `owner_user_id` BIGINT DEFAULT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_bases_code` (`code`),
  KEY `idx_knowledge_bases_owner_user_id` (`owner_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Knowledge base spaces';

CREATE TABLE `knowledge_categories` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `knowledge_base_id` BIGINT NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_categories_code` (`knowledge_base_id`, `code`),
  KEY `idx_knowledge_categories_kb_id` (`knowledge_base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Knowledge base categories';

CREATE TABLE `documents` (
  `doc_id` VARCHAR(64) NOT NULL,
  `knowledge_base_id` BIGINT DEFAULT NULL,
  `category_id` BIGINT DEFAULT NULL,
  `uploaded_by` BIGINT DEFAULT NULL,
  `reviewed_by` BIGINT DEFAULT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_path` VARCHAR(512) NOT NULL,
  `display_name` VARCHAR(255) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `file_size` BIGINT DEFAULT 0,
  `file_type` VARCHAR(50) DEFAULT NULL,
  `checksum` VARCHAR(64) DEFAULT NULL,
  `machine_type` VARCHAR(100) DEFAULT NULL,
  `metadata_json` TEXT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL,
  `hidden` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `error_message` TEXT DEFAULT NULL,
  PRIMARY KEY (`doc_id`),
  KEY `idx_documents_checksum` (`checksum`),
  KEY `idx_documents_machine_type` (`machine_type`),
  KEY `idx_documents_kb_id` (`knowledge_base_id`),
  KEY `idx_documents_category_id` (`category_id`),
  KEY `idx_documents_uploaded_by` (`uploaded_by`),
  KEY `idx_documents_status_created_at` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Uploaded documents';

CREATE TABLE `tasks` (
  `task_id` VARCHAR(64) NOT NULL,
  `target_id` VARCHAR(64) DEFAULT NULL,
  `type` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `progress` INT DEFAULT 0,
  `error_message` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` TIMESTAMP NULL DEFAULT NULL,
  `finished_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`task_id`),
  KEY `idx_tasks_target_id` (`target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Async task records';

CREATE TABLE `document_processing_event` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `doc_id` VARCHAR(64) NOT NULL,
  `file_type` VARCHAR(50) NOT NULL,
  `step` VARCHAR(50) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `message` VARCHAR(255) DEFAULT NULL,
  `payload_json` TEXT DEFAULT NULL,
  `started_at` TIMESTAMP NULL DEFAULT NULL,
  `finished_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_document_processing_event_doc_id` (`doc_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Per-step processing timeline';

CREATE TABLE `search_logs` (
  `log_id` VARCHAR(64) NOT NULL,
  `user_id` BIGINT DEFAULT NULL,
  `query_text` TEXT NOT NULL,
  `search_mode` VARCHAR(50) NOT NULL,
  `has_rerank` TINYINT(1) DEFAULT 0,
  `result_count` INT DEFAULT 0,
  `total_latency` INT DEFAULT 0,
  `es_latency` INT DEFAULT 0,
  `model_latency` INT DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_search_logs_user_id` (`user_id`),
  KEY `idx_search_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Search logs';

CREATE TABLE `feedback` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `search_id` VARCHAR(64) NOT NULL,
  `doc_id` VARCHAR(64) DEFAULT NULL,
  `chunk_id` VARCHAR(128) DEFAULT NULL,
  `rank_position` INT DEFAULT NULL,
  `is_relevant` TINYINT(1) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_feedback_search_id` (`search_id`),
  KEY `idx_feedback_doc_id` (`doc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Search relevance feedback';

CREATE TABLE `qa_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `query` TEXT NOT NULL,
  `answer` TEXT DEFAULT NULL,
  `duration_ms` BIGINT NOT NULL,
  `source_count` INT NOT NULL,
  `timestamp` DATETIME(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_qa_logs_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='QA logs';

CREATE TABLE `permission_requests` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `permission_code` VARCHAR(100) NOT NULL,
  `resource_type` VARCHAR(50) NOT NULL,
  `resource_id` VARCHAR(64) DEFAULT NULL,
  `reason` VARCHAR(500) DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `reviewer_id` BIGINT DEFAULT NULL,
  `review_comment` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_permission_requests_user_id` (`user_id`),
  KEY `idx_permission_requests_status_created_at` (`status`, `created_at`),
  KEY `idx_permission_requests_reviewer_id` (`reviewer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Permission approval requests';

CREATE TABLE `user_permission_grants` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `permission_code` VARCHAR(100) NOT NULL,
  `resource_type` VARCHAR(50) NOT NULL,
  `resource_id` VARCHAR(64) DEFAULT NULL,
  `granted_by` BIGINT DEFAULT NULL,
  `source_request_id` BIGINT DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `effective_from` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `effective_to` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_permission_grants_user_id` (`user_id`),
  KEY `idx_user_permission_grants_permission` (`permission_code`, `resource_type`, `resource_id`),
  KEY `idx_user_permission_grants_source_request_id` (`source_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Granted user permissions';

CREATE TABLE `audit_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `operator_user_id` BIGINT DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50) NOT NULL,
  `target_id` VARCHAR(64) DEFAULT NULL,
  `details_json` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_operator_user_id` (`operator_user_id`),
  KEY `idx_audit_logs_target` (`target_type`, `target_id`),
  KEY `idx_audit_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Audit trail';

ALTER TABLE `role_permissions`
  ADD CONSTRAINT `fk_role_permissions_role_id`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  ADD CONSTRAINT `fk_role_permissions_permission_id`
    FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`);

ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_user_roles_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_user_roles_role_id`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  ADD CONSTRAINT `fk_user_roles_assigned_by`
    FOREIGN KEY (`assigned_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `knowledge_bases`
  ADD CONSTRAINT `fk_knowledge_bases_owner_user_id`
    FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `knowledge_categories`
  ADD CONSTRAINT `fk_knowledge_categories_kb_id`
    FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases` (`id`);

ALTER TABLE `documents`
  ADD CONSTRAINT `fk_documents_kb_id`
    FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases` (`id`),
  ADD CONSTRAINT `fk_documents_category_id`
    FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories` (`id`),
  ADD CONSTRAINT `fk_documents_uploaded_by`
    FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_documents_reviewed_by`
    FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `document_processing_event`
  ADD CONSTRAINT `fk_document_processing_event_doc_id`
    FOREIGN KEY (`doc_id`) REFERENCES `documents` (`doc_id`);

ALTER TABLE `search_logs`
  ADD CONSTRAINT `fk_search_logs_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `feedback`
  ADD CONSTRAINT `fk_feedback_search_id`
    FOREIGN KEY (`search_id`) REFERENCES `search_logs` (`log_id`),
  ADD CONSTRAINT `fk_feedback_doc_id`
    FOREIGN KEY (`doc_id`) REFERENCES `documents` (`doc_id`);

ALTER TABLE `permission_requests`
  ADD CONSTRAINT `fk_permission_requests_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_permission_requests_reviewer_id`
    FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `user_permission_grants`
  ADD CONSTRAINT `fk_user_permission_grants_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_user_permission_grants_granted_by`
    FOREIGN KEY (`granted_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_user_permission_grants_source_request_id`
    FOREIGN KEY (`source_request_id`) REFERENCES `permission_requests` (`id`);

ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_audit_logs_operator_user_id`
    FOREIGN KEY (`operator_user_id`) REFERENCES `users` (`user_id`);

INSERT INTO `roles` (`id`, `code`, `name`, `description`, `system_role`)
VALUES
  (1, 'ADMIN', '管理员', 'System administrator', 1),
  (2, 'USER', '普通用户', 'Default business user', 1);

INSERT INTO `permissions` (`id`, `code`, `name`, `module`, `description`)
VALUES
  (1, 'system.manage', '系统管理', 'SYSTEM', 'Access system settings and runtime configuration'),
  (2, 'role.manage', '角色管理', 'AUTH', 'Manage roles and user assignments'),
  (3, 'permission.approve', '权限审批', 'AUTH', 'Approve or reject permission requests'),
  (4, 'kb.manage', '知识库管理', 'KNOWLEDGE_BASE', 'Manage knowledge bases and categories'),
  (5, 'kb.view', '知识库查看', 'KNOWLEDGE_BASE', 'View knowledge base content'),
  (6, 'kb.upload', '知识上传', 'KNOWLEDGE_BASE', 'Upload documents into an allowed knowledge base'),
  (7, 'doc.review', '文档审批', 'DOCUMENT', 'Review uploaded documents before indexing');

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (1, 4),
  (1, 5),
  (1, 6),
  (1, 7),
  (2, 5);

SET FOREIGN_KEY_CHECKS = 1;
