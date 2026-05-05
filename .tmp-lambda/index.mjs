import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });
const queueUrl = process.env.QUEUE_URL;
export const handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : event;
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(body) }));
    return { statusCode: 202, headers: {"content-type":"application/json"}, body: JSON.stringify({ accepted: true, queued: true }) };
  } catch (e) {
    return { statusCode: 500, headers: {"content-type":"application/json"}, body: JSON.stringify({ accepted: false, error: e.message }) };
  }
};
