-- ===============================================================================
-- 数据库初始化脚本
-- 项目名称: Industrial Knowledge RAG (知识检索增强生成)
-- 数据库类型: MySQL 8.0+
-- ===============================================================================

-- 创建数据库 (如果不存在)
CREATE DATABASE IF NOT EXISTS knowledge_base DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE knowledge_base;

-- ===============================================================================
-- 1. 文档表 (Documents)
-- 用于存储上传的文档元数据、存储路径及处理状态
-- 对应实体: com.graduation.knowledgeback.persistence.DocumentEntity
-- ===============================================================================
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
  `doc_id` VARCHAR(64) NOT NULL COMMENT '主键，文档唯一标识 (UUID)',
  `original_filename` VARCHAR(255) NOT NULL COMMENT '原始文件名',
  `stored_path` VARCHAR(512) NOT NULL COMMENT '文件在服务器/对象存储上的物理路径',
  `display_name` VARCHAR(255) DEFAULT NULL COMMENT '展示名称',
  `description` TEXT COMMENT '备注信息',
  `file_size` BIGINT DEFAULT 0 COMMENT '文件大小 (字节)',
  `file_type` VARCHAR(50) DEFAULT NULL COMMENT '文件类型 (如 PDF, DOCX)',
  `checksum` VARCHAR(64) DEFAULT NULL COMMENT '文件校验和 (SHA-256)，防止重复上传',
  `machine_type` VARCHAR(100) DEFAULT NULL COMMENT '显式元数据：设备型号 (用于快速过滤)',
  `metadata_json` TEXT COMMENT '其他元数据 (JSON格式)，如作者、页数、标签等',
  `status` VARCHAR(50) NOT NULL COMMENT '文档状态 (PENDING_REVIEW, APPROVED, PARSING, INDEXED, FAILED, REJECTED, UPLOADED)',
  `hidden` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否隐藏 (1: 隐藏, 0: 可见)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `error_message` TEXT COMMENT '处理失败时的错误信息',
  PRIMARY KEY (`doc_id`),
  INDEX `idx_checksum` (`checksum`),
  INDEX `idx_machine_type` (`machine_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档管理表';

-- ===============================================================================
-- 2. 任务表 (Tasks)
-- 用于追踪异步任务的执行情况，如文档解析、索引构建、批量导入等
-- 对应实体: com.graduation.knowledgeback.persistence.TaskEntity
-- ===============================================================================
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `task_id` VARCHAR(64) NOT NULL COMMENT '主键，任务唯一标识 (UUID)',
  `target_id` VARCHAR(64) DEFAULT NULL COMMENT '关联对象ID (如文档ID)，用于追踪具体对象的任务进度',
  `type` VARCHAR(50) NOT NULL COMMENT '任务类型 (DOCUMENT_INGESTION, INDEX_REBUILD, EVALUATION)',
  `status` VARCHAR(50) NOT NULL COMMENT '任务状态 (QUEUED, RUNNING, COMPLETED, FAILED)',
  `progress` INT DEFAULT 0 COMMENT '任务进度 (0-100)',
  `error_message` TEXT COMMENT '任务失败时的错误堆栈或提示',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '任务创建时间',
  `started_at` TIMESTAMP NULL COMMENT '任务开始执行时间',
  `finished_at` TIMESTAMP NULL COMMENT '任务结束时间',
  PRIMARY KEY (`task_id`),
  INDEX `idx_target` (`target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异步任务记录表';

-- ===============================================================================
-- 3. 用户与权限表 (Users)
-- 用于区分管理端和普通用户端，控制系统访问权限
-- 对应实体: com.graduation.knowledgeback.persistence.UserEntity
-- ===============================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` BIGINT AUTO_INCREMENT NOT NULL COMMENT '主键，用户ID',
  `username` VARCHAR(64) NOT NULL COMMENT '用户名',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '加密后的密码',
  `role` VARCHAR(20) NOT NULL DEFAULT 'USER' COMMENT '角色权限 (ADMIN: 管理员, USER: 普通用户)',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '联系邮箱',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `last_login` TIMESTAMP NULL COMMENT '最后登录时间',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户权限管理表';

-- ===============================================================================
-- 4. 搜索日志表 (Search Logs)
-- 记录每一次检索的详细参数与性能指标，用于对比实验分析 (混合检索 vs 纯向量)
-- 对应实体: com.graduation.knowledgeback.persistence.SearchLogEntity
-- ===============================================================================
DROP TABLE IF EXISTS `search_logs`;
CREATE TABLE `search_logs` (
  `log_id` VARCHAR(64) NOT NULL COMMENT '主键，搜索会话ID (UUID)',
  `user_id` BIGINT DEFAULT NULL COMMENT '发起搜索的用户ID (可为空)',
  `query_text` TEXT NOT NULL COMMENT '用户的搜索语句',
  `search_mode` VARCHAR(50) NOT NULL COMMENT '检索模式 (VECTOR_ONLY, KEYWORD_ONLY, HYBRID)',
  `has_rerank` TINYINT(1) DEFAULT 0 COMMENT '是否启用了重排序 (1:是, 0:否)',
  `result_count` INT DEFAULT 0 COMMENT '返回的结果数量',
  `total_latency` INT DEFAULT 0 COMMENT '总耗时 (ms)',
  `es_latency` INT DEFAULT 0 COMMENT 'ES/向量库 检索耗时 (ms)',
  `model_latency` INT DEFAULT 0 COMMENT '模型(Embedding/Rerank) 推理耗时 (ms)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '搜索时间',
  PRIMARY KEY (`log_id`),
  INDEX `idx_user` (`user_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全链路搜索日志表';

-- ===============================================================================
-- 5. 反馈表 (Feedback)
-- 存储用户对搜索结果的反馈 (RLHF)，用于后续的检索效果评估和重排序模型优化
-- 对应实体: com.graduation.knowledgeback.persistence.FeedbackEntity
-- ===============================================================================
DROP TABLE IF EXISTS `feedback`;
CREATE TABLE `feedback` (
  `id` BIGINT AUTO_INCREMENT NOT NULL COMMENT '主键，自增 ID',
  `search_id` VARCHAR(64) NOT NULL COMMENT '搜索会话 ID，关联一次特定的搜索请求',
  `doc_id` VARCHAR(64) DEFAULT NULL COMMENT '关联的文档 ID',
  `chunk_id` VARCHAR(128) DEFAULT NULL COMMENT '关联的切片 ID (Vector DB 中的 ID)',
  `rank_position` INT DEFAULT NULL COMMENT '该结果在搜索列表中的原始排名 (1-base)',
  `is_relevant` TINYINT(1) NOT NULL COMMENT '用户反馈的相关性 (1: 相关/有用, 0: 不相关/无用)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '反馈时间',
  PRIMARY KEY (`id`),
  INDEX `idx_search_id` (`search_id`),
  INDEX `idx_doc_id` (`doc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='搜索效果反馈表';
