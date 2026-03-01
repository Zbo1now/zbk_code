package com.graduation.knowledgeback.service;

import com.graduation.knowledgeback.domain.TaskType;
import com.graduation.knowledgeback.persistence.TaskEntity;
import com.graduation.knowledgeback.persistence.TaskRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class TaskService {
    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public TaskEntity create(TaskType type) {
        var task = new TaskEntity("job_" + UUID.randomUUID(), type);
        return taskRepository.save(task);
    }

    public Optional<TaskEntity> find(String taskId) {
        return taskRepository.findById(taskId);
    }

    public TaskEntity save(TaskEntity task) {
        return taskRepository.save(task);
    }

    @Async
    public void runAsync(String taskId, Runnable runnable) {
        try {
            runnable.run();
        } catch (Exception ignore) {
            // 状态更新在 runnable 里处理
        }
    }
}
