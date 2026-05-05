# X-Ray for Task #2 (Lambda + API Gateway)

Use this guide for **CT071 Task #2 Part 3** performance evidence.

## Scope

The serverless sample at `deploy/aws/serverless-http-lambda-sqs` already enables:

- `Tracing: Active` for Lambda in `template.yaml`
- API Gateway integration path to Lambda

This allows traces to appear in **AWS X-Ray Service map** after requests hit `/enqueue`.

## 1) Verify IAM permissions

Your lab role should allow at least read actions for X-Ray dashboards:

- `xray:GetServiceGraph`
- `xray:GetTraceSummaries`
- `xray:BatchGetTraces`

(Write permissions are handled by managed services for API Gateway/Lambda.)

## 2) Generate traffic

```bash
API_URL="https://<api-id>.execute-api.<region>.amazonaws.com"
for i in {1..25}; do
  curl -sS -X POST "$API_URL/enqueue"     -H "content-type: application/json"     -d "{"run":$i,"source":"xray-test"}" >/dev/null
  sleep 0.2
done
```

## 3) Capture X-Ray evidence

In AWS Console:

1. Open **X-Ray -> Service map**
2. Set time range to last 15-30 minutes
3. Confirm nodes for API Gateway and Lambda appear
4. Open traces and capture latency details

## 4) Useful analysis points for report

- Request path latency (API Gateway -> Lambda)
- Error rate (if any 4xx/5xx)
- Cold start effect on first requests
- Average duration under burst load

## 5) Screenshot checklist (Part 3)

- [ ] Service map with API Gateway and Lambda
- [ ] Trace timeline (one normal request)
- [ ] Trace timeline (slow or cold-start request)
- [ ] Lambda duration metric aligned with X-Ray trace window

## Notes

- X-Ray data can take a short while to appear.
- If service map is empty, re-run traffic and expand time window.
