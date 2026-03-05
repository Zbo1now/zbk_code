package com.graduation.knowledgeback.persistence;

import com.graduation.knowledgeback.domain.TaskStatus;
import com.graduation.knowledgeback.domain.TaskType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "tasks")
public class TaskEntity {
    @Id
    @Column(length = 64)
    private String taskId;

    @Column(length = 64)
    private String targetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status;

    @Column
    private Integer progress;

    @Column(columnDefinition = "CLOB")
    private String errorMessage;

    @Column(nullable = false)
    private Instant createdAt;

    @Column
    private Instant startedAt;

    @Column
    private Instant finishedAt;

    protected TaskEntity() {
    }

    public TaskEntity(String taskId, TaskType type) {
        this.taskId = taskId;
        this.type = type;
        this.status = TaskStatus.QUEUED;
        this.createdAt = Instant.now();
    }

    public String getTaskId() {
        return taskId;
    }

    public TaskType getType() {
        return type;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public Integer getProgress() {
        return progress;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public void start() {
        this.status = TaskStatus.RUNNING;
        this.startedAt = Instant.now();
        this.progress = 0;
    }

    public void succeed() {
        this.status = TaskStatus.SUCCEEDED;
        this.progress = 100;
        this.finishedAt = Instant.now();
    }

    public void fail(String message) {
        this.status = TaskStatus.FAILED;
        this.errorMessage = message;
        this.finishedAt = Instant.now();
    }

    public void setProgress(Integer progress) {
        this.progress = progress;
    }
}
