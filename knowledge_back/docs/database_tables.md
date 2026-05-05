# 数据库表说明

## 用户与权限

### `users`
- 用途：保存系统用户基础信息。
- 关键字段：`username`、`password_hash`、`display_name`、`email`、`department`、`enabled`。
- 说明：这是“用户信息”的主表。登录、展示名、邮箱、部门、启停状态都在这里。

### `roles`
- 用途：定义系统角色。
- 典型数据：`ADMIN`、`USER`。

### `permissions`
- 用途：定义系统权限点。
- 典型数据：`system.manage`、`role.manage`、`kb.view`、`kb.upload`、`doc.review`。

### `role_permissions`
- 用途：角色与权限的关联关系。
- 说明：一个角色可以挂多个权限。

### `user_roles`
- 用途：用户与角色的关联关系。
- 说明：支持一个用户拥有多个角色。

### `permission_requests`
- 用途：记录用户发起的权限申请。
- 说明：后续“知识库查看申请、上传申请、审批流”主要依赖这张表。

### `user_permission_grants`
- 用途：记录最终生效的用户授权。
- 说明：真正判断用户是否有某项资源权限时，除了角色，还要看这张表。

### `audit_logs`
- 用途：记录关键管理动作。
- 说明：适合记录角色调整、权限审批、系统配置修改等操作。

## 知识库资源

### `knowledge_bases`
- 用途：知识库主表。
- 说明：一个知识库可以理解成一个业务域、资料域或空间。

### `knowledge_categories`
- 用途：知识库分类表。
- 说明：分类从属于知识库，用于展示、过滤和后续按分类管理。

### `documents`
- 用途：文档主表。
- 关键字段：`knowledge_base_id`、`category_id`、`uploaded_by`、`reviewed_by`、`status`、`hidden`。
- 说明：文档上传、审批、处理状态和归属信息都在这张表。

### `document_processing_event`
- 用途：文档处理时间线事件表。
- 说明：记录上传、审核、解析、切片、向量化、入库等步骤的详细过程。

### `tasks`
- 用途：异步任务表。
- 说明：用于记录重建索引、删除文档、异步处理等后台任务状态。

## 检索与问答

### `search_logs`
- 用途：检索日志。
- 说明：记录检索请求、模式、结果数和耗时。

### `feedback`
- 用途：检索反馈。
- 说明：用于记录用户对检索结果是否相关的反馈。

### `qa_logs`
- 用途：问答日志。
- 说明：记录问题、答案、耗时和引用来源数量。

## 用户信息到底在哪些表

### 主体信息
- 主表是 `users`。
- 登录用户名、密码哈希、显示名、邮箱、部门、启用状态都在这里。

### 角色信息
- 角色定义在 `roles`。
- 用户拥有哪些角色，在 `user_roles`。

### 权限信息
- 权限定义在 `permissions`。
- 角色默认权限在 `role_permissions`。
- 用户通过审批得到的额外权限在 `user_permission_grants`。

### 申请与审批信息
- 用户申请记录在 `permission_requests`。
- 管理动作留痕在 `audit_logs`。
