#!/bin/bash
# Amazon Linux 2023 / AL2 example: append instance identity into /etc/securechat.env for Path / SecureChat Network.
# Run once from EC2 user data after creating /etc/securechat.env from env.production.example (without EC2_INSTANCE_ID).
set -euo pipefail

ENV_FILE=/etc/securechat.env
TOKEN=$(curl -sS -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
IID=$(curl -sS -H "X-aws-ec2-metadata-token: ${TOKEN}" "http://169.254.169.254/latest/meta-data/instance-id")
REG=$(curl -sS -H "X-aws-ec2-metadata-token: ${TOKEN}" "http://169.254.169.254/latest/meta-data/placement/region")

touch "${ENV_FILE}"
grep -q '^EC2_INSTANCE_ID=' "${ENV_FILE}" 2>/dev/null && sed -i '/^EC2_INSTANCE_ID=/d' "${ENV_FILE}"
grep -q '^AWS_REGION=' "${ENV_FILE}" 2>/dev/null && sed -i '/^AWS_REGION=/d' "${ENV_FILE}"
{
  echo "EC2_INSTANCE_ID=${IID}"
  echo "AWS_REGION=${REG}"
} >> "${ENV_FILE}"

chmod 600 "${ENV_FILE}"
