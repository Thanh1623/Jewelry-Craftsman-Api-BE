import { CraftsmanRequest } from '@prisma/client';

export interface ReplyWebhookPayload {
  requestId: string;
  answer: string;
  craftsmanName: string;
  answeredAt: string;
}

export function mapRequestToReplyWebhookPayload(
  request: CraftsmanRequest,
  craftsmanName: string,
): ReplyWebhookPayload {
  return {
    requestId: request.shopRequestId,
    answer: request.answer ?? '',
    craftsmanName,
    answeredAt: (request.answeredAt ?? new Date()).toISOString(),
  };
}
