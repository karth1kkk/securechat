# Task #2 Serverless Integration (API Gateway + Lambda + SQS)

This folder provides a simple serverless flow for **CT071 Task #2 Part 2**:

- **Amazon API Gateway (HTTP API)** exposes `POST /enqueue`
- **AWS Lambda** receives payload and pushes it to
- **Amazon SQS** queue

This is intentionally independent from the main `SecureChatBackend` GraphQL API.

## Files

- `template.yaml` - SAM infrastructure template
- `lambda/app.py` - Lambda handler
- `samconfig.toml` - SAM deploy defaults

## Prerequisites

- AWS CLI configured (`aws sts get-caller-identity` works)
- SAM CLI installed (`sam --version`)
- Region set to match `samconfig.toml` (default `us-east-1`)

## Deploy

```bash
cd deploy/aws/serverless-http-lambda-sqs
sam build
sam deploy
```

After deploy, capture outputs:

```bash
aws cloudformation describe-stacks   --stack-name securechat-task2-ingest   --query "Stacks[0].Outputs"
```

## Test

Use the `HttpApiUrl` output from CloudFormation:

```bash
curl -sS -X POST "https://<api-id>.execute-api.<region>.amazonaws.com/enqueue"   -H "content-type: application/json"   -d '{"event":"task2-demo","message":"hello from api gateway"}'
```

Expected response:

```json
{"accepted":true,"queued":true}
```

Then verify message arrival in SQS (console or CLI):

```bash
aws sqs receive-message --queue-url "<IngestionQueueUrl>" --max-number-of-messages 1
```

## Cleanup

```bash
sam delete
```

## Evidence checklist (for report)

- [ ] `sam deploy` success screenshot
- [ ] CloudFormation resources (API, Lambda, Queue)
- [ ] `curl POST /enqueue` request/response
- [ ] SQS message visible in queue
- [ ] Lambda monitor tab with invocation metric
