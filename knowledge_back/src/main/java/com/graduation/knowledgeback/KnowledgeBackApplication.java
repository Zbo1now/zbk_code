package com.graduation.knowledgeback;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class KnowledgeBackApplication {
    public static void main(String[] args)
    {
        SpringApplication.run(KnowledgeBackApplication.class, args);
    }
}
