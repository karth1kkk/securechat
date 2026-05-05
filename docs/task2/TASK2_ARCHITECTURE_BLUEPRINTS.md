# Task #2 Architecture Blueprints (Old vs New)

Use these as editable templates for Part 1 and Part 3 report content.

## Task #1 Baseline (Server-based)

```mermaid
flowchart LR
  U[Mobile/Web Client] --> ALB[Application Load Balancer]
  ALB --> API[SecureChatBackend on EC2/ECS]
  API --> DB[(Amazon RDS PostgreSQL)]
  API --> CW[CloudWatch Logs/Metrics]
```

## Task #2 Updated (Hybrid with Serverless)

```mermaid
flowchart LR
  U[Mobile/Web Client] --> ALB[ALB -> SecureChatBackend]
  ALB --> API[SecureChatBackend on EC2/ECS]
  API --> DB[(Amazon RDS PostgreSQL)]

  U --> APIGW[API Gateway HTTP API]
  APIGW --> L[Lambda EnqueueFunction]
  L --> Q[(Amazon SQS Queue)]

  API --> CW[CloudWatch]
  L --> CW
  APIGW --> XR[X-Ray Service Map]
  L --> XR
```

## Discussion prompts (copy into report)

- Why serverless was added and which flow was moved to Lambda.
- How SQS decouples traffic spikes from processing.
- Cost/ops tradeoff between always-on EC2 service and pay-per-use Lambda.
- Monitoring differences: EC2 metrics/logs vs Lambda/X-Ray traces.
