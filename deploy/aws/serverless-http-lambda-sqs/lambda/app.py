"""
API Gateway HTTP API (payload format v2) -> enqueue message on SQS.
Used for CT071 Task #2 serverless + SQS integration (not the main SecureChat GraphQL API).
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any

import boto3

_sqs = boto3.client("sqs")
_queue_url = os.environ.get("QUEUE_URL", "")


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if not _queue_url:
        return _response(500, {"error": "QUEUE_URL is not configured"})

    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8", errors="replace")

    if not isinstance(body, str):
        body = json.dumps(body)

    # SQS max message size 256 KiB
    encoded = body.encode("utf-8")
    if len(encoded) > 256 * 1024:
        body = encoded[: 256 * 1024 - 1].decode("utf-8", errors="ignore")

    _sqs.send_message(QueueUrl=_queue_url, MessageBody=body)

    return _response(202, {"accepted": True, "queued": True})


def _response(status: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }
