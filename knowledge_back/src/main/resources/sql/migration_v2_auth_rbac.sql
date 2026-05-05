-- ==============================================================================
-- Migration: upgrade legacy schema to auth + RBAC + knowledge-base permission model
-- Target database: MySQL 8.0+
-- Notes:
-- 1. Execute this script once on an existing legacy database.
-- 2. Back up the database before running.
-- 3. The default admin account seeded below uses a legacy plain password and will
--    be upgraded to BCrypt automatically after the first successful login.
-- ==============================================================================

USE knowledge_base;

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `users`
  ADD COLUMN `display_name` VARCHAR(100) NULL AFTER `role`,
  ADD COLUMN `department` VARCHAR(100) NULL AFTER `email`,
  ADD COLUMN `enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `department`;

ALTER TABLE `documents`
  ADD COLUMN `knowledge_base_id` BIGINT NULL AFTER `doc_id`,
  ADD COLUMN `category_id` BIGINT NULL AFTER `knowledge_base_id`,
  ADD COLUMN `uploaded_by` BIGINT NULL AFTER `category_id`,
  ADD COLUMN `reviewed_by` BIGINT NULL AFTER `uploaded_by`,
  ADD COLUMN `reviewed_at` TIMESTAMP NULL DEFAULT NULL AFTER `created_at`;

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

INSERT INTO `roles` (`code`, `name`, `description`, `system_role`)
SELECT 'ADMIN', 'Administrator', 'System administrator', 1
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `code` = 'ADMIN');

INSERT INTO `roles` (`code`, `name`, `description`, `system_role`)
SELECT 'USER', 'User', 'Default business user', 1
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `code` = 'USER');

INSERT INTO `permissions` (`code`, `name`, `module`, `description`)
SELECT 'system.manage', '系统管理', 'SYSTEM', 'Access system settings and runtime configuration'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'system.manage');

INSERT INTO `permissions` (`code`, `name`, `module`, `description`)
SELECT 'role.manage', '角色管理', 'AUTH', 'Manage roles and user assignments'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'role.manage');

INSERT INTO `permissions` (`code`, `name`, `module`, `description`)
SELECT 'permission.approve', '权限审批', 'AUTH', 'Approve or reject permission requests'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'permission.approve');

INSERT INTO `permissions` (`code`, `name`, `module`, `description`)
SELECT 'kb.manage', '知识库管理', 'KNOWLEDGE_BASE', 'Manage knowledge bases and categories'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'kb.manage');

INSERT INTO `permissions` (`code`, `name`, `module`, `description`)
SELECT 'kb.view', '知识库查看', 'KNOWLEDGE_BASE', 'View knowledge base content'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'kb.view');

INSERT INTO `permissions` (`code`, `name`, `module`, `description`)
SELECT 'kb.upload', '知识上传', 'KNOWLEDGE_BASE', 'Upload documents into an allowed knowledge base'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'kb.upload');

INSERT INTO `permissions` (`code`, `name`, `module`, `description`)
SELECT 'doc.review', '文档审批', 'DOCUMENT', 'Review uploaded documents before indexing'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'doc.review');

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.code IN (
  'system.manage', 'role.manage', 'permission.approve', 'kb.manage', 'kb.view', 'kb.upload', 'doc.review'
)
WHERE r.code = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.code = 'kb.view'
WHERE r.code = 'USER'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`)
SELECT u.user_id, r.id, CURRENT_TIMESTAMP
FROM `users` u
JOIN `roles` r ON r.code = UPPER(COALESCE(u.role, 'USER'))
WHERE NOT EXISTS (
  SELECT 1 FROM `user_roles` ur WHERE ur.user_id = u.user_id AND ur.role_id = r.id
);

INSERT INTO `users` (`username`, `password_hash`, `role`, `display_name`, `enabled`)
SELECT 'admin', 'Admin@123', 'ADMIN', 'Admin', 1
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `username` = 'admin');

INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`)
SELECT u.user_id, r.id, CURRENT_TIMESTAMP
FROM `users` u
JOIN `roles` r ON r.code = 'ADMIN'
WHERE u.username = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM `user_roles` ur WHERE ur.user_id = u.user_id AND ur.role_id = r.id
  );

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

SET FOREIGN_KEY_CHECKS = 1;
