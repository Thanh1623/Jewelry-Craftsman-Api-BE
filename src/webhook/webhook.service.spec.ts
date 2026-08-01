import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { RequestService } from '../request/request.service';
import { AskCraftsmanDto } from './dto/ask-craftsman.dto';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  const webhookSecret = 'test-secret';
  const inputDto: AskCraftsmanDto = {
    requestId: 'a1111111-1111-1111-1111-111111111111',
    chatSessionId: 'b2222222-2222-2222-2222-222222222222',
    productId: 'c3333333-3333-3333-3333-333333333333',
    productName: 'Nhẫn vàng 18K',
    productWeightGrams: 12.5,
    productLaborCost: 150000,
    productBaseSize: 6,
    question: 'Có thể làm size nhỏ hơn không?',
    customerNote: 'Khách muốn giao trước thứ 6',
    replyWebhookUrl: 'http://localhost:3000/api/webhooks/craftsman/reply',
  };

  let mockPrisma: {
    craftsmanRequest: { upsert: jest.Mock };
    requestMessage: { count: jest.Mock };
  };
  let mockPushService: { notifyNewRequest: jest.Mock };
  let mockConfigService: { get: jest.Mock };
  let mockRequestService: { seedThreadFromRequest: jest.Mock };
  let service: WebhookService;

  beforeEach(() => {
    mockPrisma = {
      craftsmanRequest: { upsert: jest.fn() },
      requestMessage: { count: jest.fn().mockResolvedValue(0) },
    };
    mockPushService = {
      notifyNewRequest: jest.fn().mockResolvedValue(undefined),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue(webhookSecret),
    };
    mockRequestService = {
      seedThreadFromRequest: jest.fn().mockResolvedValue(undefined),
    };

    service = new WebhookService(
      mockPrisma as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
      mockPushService as unknown as PushService,
      mockRequestService as unknown as RequestService,
    );
  });

  it('throws UnauthorizedException when the webhook secret is missing or wrong', async () => {
    await expect(
      service.handleAskCraftsman('wrong-secret', inputDto),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.craftsmanRequest.upsert).not.toHaveBeenCalled();
  });

  it('upserts a PENDING request keyed by shopRequestId and returns { ok, id }', async () => {
    const persistedRequest = {
      id: 'd4444444-4444-4444-4444-444444444444',
      shopRequestId: inputDto.requestId,
      status: RequestStatus.PENDING,
      question: inputDto.question,
      productName: inputDto.productName,
    };
    mockPrisma.craftsmanRequest.upsert.mockResolvedValue(persistedRequest);

    const actualResult = await service.handleAskCraftsman(
      webhookSecret,
      inputDto,
    );

    expect(mockPrisma.craftsmanRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopRequestId: inputDto.requestId },
        create: expect.objectContaining({
          shopRequestId: inputDto.requestId,
          chatSessionId: inputDto.chatSessionId,
          productName: inputDto.productName,
        }) as Record<string, unknown>,
      }),
    );
    expect(mockRequestService.seedThreadFromRequest).toHaveBeenCalledWith(
      persistedRequest,
    );
    expect(actualResult).toEqual({ ok: true, id: persistedRequest.id });
  });

  it('triggers a web push notification for a newly created PENDING request', async () => {
    const persistedRequest = {
      id: 'd4444444-4444-4444-4444-444444444444',
      status: RequestStatus.PENDING,
    };
    mockPrisma.craftsmanRequest.upsert.mockResolvedValue(persistedRequest);

    await service.handleAskCraftsman(webhookSecret, inputDto);

    expect(mockPushService.notifyNewRequest).toHaveBeenCalledWith(
      persistedRequest,
    );
  });

  it('does not push again when the upserted request is already ANSWERED', async () => {
    const persistedRequest = {
      id: 'd4444444-4444-4444-4444-444444444444',
      status: RequestStatus.ANSWERED,
    };
    mockPrisma.craftsmanRequest.upsert.mockResolvedValue(persistedRequest);

    await service.handleAskCraftsman(webhookSecret, inputDto);

    expect(mockPushService.notifyNewRequest).not.toHaveBeenCalled();
  });
});
