# X-Ray for Task #2 (Lambda + API Gateway)

Use this guide for **CT071 Task #2 Part 3** performance evidence.

## Scope

### Serverless path (API Gateway + Lambda)

Turn on **Active tracing** on the Lambda and tracing on the HTTP API stage (`prod`). After that, POST several times to `/enqueue` and open **X-Ray → Service map**.

### SecureChat API on EC2/Docker (ASP.NET)

Production config enables X-Ray in `appsettings.Production.json` under `Tracing:XRayEnabled`.

The app sends segments to the X-Ray daemon over UDP. Run the official daemon on the same Docker network as the API:

```bash
# On the EC2 host
sudo bash deploy/aws/start-xray-daemon.sh
```

Then run the API container on network `securechat-obs` with:

- `AWS_XRAY_DAEMON_ADDRESS=xray-daemon:2000`

Give the EC2 instance an IAM instance profile with **`AWSXRayDaemonWriteAccess`** so the daemon can call `xray:PutTraceSegments`.

---

The serverless sample at `deploy/aws/serverless-http-lambda-sqs` can also enable tracing in `template.yaml` if you deploy from that template.

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
