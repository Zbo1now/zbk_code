package com.graduation.knowledgeback.service;

/**
 * Document-level metadata extracted from JSONL payloads.
 * docId corresponds to payload field: doc_id.
 */
public record DocumentMeta(
        String docId,
        String title,
        String source,
        String fileType
) {
}
