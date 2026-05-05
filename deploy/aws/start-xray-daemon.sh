#!/usr/bin/env bash
# Run on the EC2 host alongside the SecureChat API container so traces reach the daemon.
#
# Prerequisites:
# - Docker
# - API container recreated on network securechat-obs with:
#     -e AWS_XRAY_DAEMON_ADDRESS=xray-daemon:2000
#
set -euo pipefail

NETWORK="${NETWORK:-securechat-obs}"

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK"

docker rm -f xray-daemon >/dev/null 2>&1 || true
docker pull amazon/aws-xray-daemon:latest
docker run -d \
  --name xray-daemon \
  --restart unless-stopped \
  --network "$NETWORK" \
  amazon/aws-xray-daemon:latest

echo "xray-daemon running on Docker network '$NETWORK'. Point the API at AWS_XRAY_DAEMON_ADDRESS=xray-daemon:2000"
