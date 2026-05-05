# CloudWatch for SecureChat on EC2 + Docker

Applies when the API runs in Docker on **Amazon Linux 2023** (same VPC as RDS). Your learner **IAM role** (`LabRole`) must allow the APIs below; if something is denied, check with your instructor or attach a supplementary policy.

---

## 1. What you get without extra software

- **EC2 → Monitoring:** CPU, network in/out, status checks (default **5-minute** granularity; you can enable **detailed monitoring** for 1-minute charges).
- **Billing:** Detailed monitoring costs extra per instance ([pricing](https://aws.amazon.com/cloudwatch/pricing/)).

**Console:** EC2 → your instance → **Monitoring** tab.

---

## 2. Log Docker container output to CloudWatch Logs

This is usually the highest-value step for debugging the .NET app.

### 2a. Create a log group

**CloudWatch → Log groups → Create log group**

- **Name:** e.g. `/securechat/api`
- **Retention:** 7–30 days (lab) or longer for production

### 2b. IAM on the EC2 instance

The instance role (`LabRole`) needs at least:

- `logs:CreateLogStream`
- `logs:PutLogEvents`
- `logs:CreateLogGroup` (optional if you pre-created the group; otherwise handy)

Example policy snippet (adjust region / account):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecureChatApiLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:CreateLogGroup",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:REGION:ACCOUNT_ID:log-group:/securechat/api:*"
    }
  ]
}
```

Attach this to **`LabRole`** (or merge into the lab policy if their console allows).

### 2c. Run the container with the `awslogs` driver

On EC2, after ECR login/pull, use (replace `REGION`, image URI):

```bash
sudo docker rm -f securechat-api 2>/dev/null

sudo docker run -d --name securechat-api --restart unless-stopped \
  -p 8080:8080 \
  --env-file /etc/securechat.env \
  --log-driver=awslogs \
  --log-opt awslogs-region=us-east-1 \
  --log-opt awslogs-group=/securechat/api \
  --log-opt awslogs-stream-prefix=ec2 \
  637205239152.dkr.ecr.us-east-1.amazonaws.com/securechat-api:v1
```

**CloudWatch → Log groups → `/securechat/api`** should show a log stream within a minute of startup. If you see IAM errors in `docker logs` or the container exits, fix permissions.

---

## 3. CloudWatch Agent (optional): memory and disk metrics

Default EC2 metrics do **not** include **RAM** or **disk used**. Install the **unified CloudWatch agent** to publish them.

1. **IAM:** policy allowing `cloudwatch:PutMetricData` for the agent’s namespace (e.g. `CWAgent`). Labs may supply a managed policy.
2. **Install on AL2023** — follow the current AWS doc: [Install CloudWatch agent on Amazon Linux 2023](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Install-CloudWatch-Agent.html).
3. Use the wizard or a JSON config for `metrics` → `append_dimensions` `InstanceId` → collect `mem`, `disk`.

Skip this in a short lab if basic CPU + app logs are enough.

---

## 4. Alarms (recommended)

**CloudWatch → Alarms → Create alarm**

| Suggested alarm        | Metric / source                                  | Threshold idea   |
|------------------------|--------------------------------------------------|------------------|
| Instance CPU high      | EC2 → `CPUUtilization` (Average)                | \> 80% for 15 min |
| Instance status failed | EC2 → `StatusCheckFailed`                        | \> 0 (Any)        |
| Disk full (if agent on)| `CWAgent` disk used %                            | \> 85%            |
| Target unhealthy       | **ApplicationELB** `UnHealthyHostCount` (if ALB) | \> 0              |
| ALB 5xx                | **ApplicationELB** `HTTPCode_Target_5XX_Count`   | \> 0 for 5 min    |

**SNS:** Create a **topic** + **email** subscription for notifications (confirm the email).

---

## 5. Application Load Balancer (when you add it)

- Enable **access logs** to S3 (optional, for HTTP forensics).
- Use ALB metrics + target group unhealthy alarms above.

---

## 6. X-Ray (Task #2 requirement)

For Task #2 Part 3 evidence, use [`XRAY.md`](XRAY.md) to capture:

- Service map (API Gateway -> Lambda)
- Trace latency timeline
- Basic performance discussion

CloudWatch + X-Ray screenshots together satisfy the monitoring section of the brief.

---

## Quick checklist

1. [ ] Log group `/securechat/api` created  
2. [ ] IAM allows `logs:PutLogEvents` (and related) for that group  
3. [ ] `docker run` with `--log-driver=awslogs` and `awslogs-group`  
4. [ ] (Optional) CloudWatch agent for mem/disk  
5. [ ] Alarms + SNS email  

If the lab blocks **`logs:*`**, keep using `sudo docker logs securechat-api` on the instance and only use **EC2 default metrics**.
