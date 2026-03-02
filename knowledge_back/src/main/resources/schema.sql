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
  `metadata_json` TEXT COMMENT '额外的元数据 (JSON格式)，如作者、页数、标签等',
  `status` VARCHAR(50) NOT NULL COMMENT '文档状态 (UPLOADED, PARSING, INDEXING, COMPLETED, FAILED)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `error_message` TEXT COMMENT '处理失败时的错误信息',
  PRIMARY KEY (`doc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档管理表';

-- ===============================================================================
-- 2. 任务表 (Tasks)
-- 用于追踪异步任务的执行情况，如文档解析、索引构建、批量导入等
-- 对应实体: com.graduation.knowledgeback.persistence.TaskEntity
-- ===============================================================================
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `task_id` VARCHAR(64) NOT NULL COMMENT '主键，任务唯一标识 (UUID)',
  `type` VARCHAR(50) NOT NULL COMMENT '任务类型 (DOCUMENT_INGESTION, INDEX_REBUILD, EVALUATION)',
  `status` VARCHAR(50) NOT NULL COMMENT '任务状态 (QUEUED, RUNNING, COMPLETED, FAILED)',
  `progress` INT DEFAULT 0 COMMENT '任务进度 (0-100)',
  `error_message` TEXT COMMENT '任务失败时的错误堆栈或提示',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '任务创建时间',
  `started_at` TIMESTAMP NULL COMMENT '任务开始执行时间',
  `finished_at` TIMESTAMP NULL COMMENT '任务结束时间',
  PRIMARY KEY (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异步任务记录表';

-- ===============================================================================
-- 3. 反馈表 (Feedback)
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
