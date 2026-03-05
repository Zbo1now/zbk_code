package com.graduation.knowledgeback.domain;

public enum DocumentStatus {
    PENDING_REVIEW, // 待审核 (上传后默认状态)
    APPROVED,       // 已通过 (等待解析)
    REJECTED,       // 已拒绝
    PARSING,        // 解析中
    INDEXED,        // 已索引 (流程结束)
    UPLOADED,       // (保留兼容) 已上传
    FAILED          // 失败
}
