package com.graduation.knowledgeback.domain;

public enum ProcessingStep {
    UPLOAD,
    REVIEW,
    PARSE,
    CHUNK,
    EMBED,
    INDEX_ES,
    INDEX_QDRANT,
    COMPLETE
}
