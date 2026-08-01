import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestMessageSender, RequestStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AnswerRequestDto } from './dto/answer-request.dto';
import { RequestService } from './request.service';

describe('RequestService.answer', () => {
  const webhookSecret = 'test-secret';
  const craftsman = { sub: 'user-1', fullName: 'Nguyễn Văn Thợ' };
  const answerDto: AnswerRequestDto = { answer: 'Có thể làm size 5.' };

  const existingRequest = {
    id: 'req-1',
    shopRequestId: 'shop-req-1',
    replyWebhookUrl: 'http://localhost:3000/api/webhooks/craftsman/reply',
    status: RequestStatus.PENDING,
    answer: null,
    answeredById: null,
    answeredAt: null,
    messages: [
      {
        id: 'msg-1',
        sender: RequestMessageSender.SHOP,
        content: 'Câu hỏi shop',
        imageUrl: null,
      },
    ],
  };

  let mockPrisma: {
    craftsmanRequest: { findUnique: jest.Mock; update: jest.Mock };
    requestMessage: { create: jest.Mock };
  };
  let mockConfigService: { get: jest.Mock };
  let service: RequestService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    mockPrisma = {
      craftsmanRequest: {
        findUnique: jest.fn().mockResolvedValue(existingRequest),
        update: jest.fn(),
      },
      requestMessage: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    mockConfigService = { get: jest.fn().mockReturnValue(webhookSecret) };
    service = new RequestService(
      mockPrisma as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
    );
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('rejects answering a request that is already ANSWERED', async () => {
    mockPrisma.craftsmanRequest.findUnique.mockResolvedValue({
      ...existingRequest,
      status: RequestStatus.ANSWERED,
    });

    await expect(service.answer('req-1', answerDto, craftsman)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.craftsmanRequest.update).not.toHaveBeenCalled();
  });

  it('saves the answer, then POSTs the exact contract payload to replyWebhookUrl', async () => {
    const answeredAt = new Date('2026-08-02T10:00:00.000Z');
    const updatedRequest = {
      ...existingRequest,
      status: RequestStatus.ANSWERED,
      answer: answerDto.answer,
      answeredById: craftsman.sub,
      answeredAt,
      messages: [
        ...existingRequest.messages,
        {
          id: 'msg-2',
          sender: RequestMessageSender.CRAFTSMAN,
          content: answerDto.answer,
        },
      ],
    };
    mockPrisma.craftsmanRequest.update.mockResolvedValue(updatedRequest);

    const actualResult = await service.answer('req-1', answerDto, craftsman);

    expect(mockPrisma.craftsmanRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({
          status: RequestStatus.ANSWERED,
          answer: answerDto.answer,
          answeredById: craftsman.sub,
        }) as Record<string, unknown>,
      }),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(existingRequest.replyWebhookUrl);
    expect(options?.method).toBe('POST');
    expect(
      (options?.headers as Record<string, string>)['X-Webhook-Secret'],
    ).toBe(webhookSecret);
    expect(JSON.parse(options?.body as string)).toEqual({
      requestId: existingRequest.shopRequestId,
      answer: answerDto.answer,
      craftsmanName: craftsman.fullName,
      answeredAt: answeredAt.toISOString(),
    });
    expect(actualResult.warning).toBeUndefined();
  });

  it('keeps the saved answer and returns a warning when the shop webhook call fails', async () => {
    const updatedRequest = {
      ...existingRequest,
      status: RequestStatus.ANSWERED,
      answer: answerDto.answer,
      answeredById: craftsman.sub,
      answeredAt: new Date(),
      messages: existingRequest.messages,
    };
    mockPrisma.craftsmanRequest.update.mockResolvedValue(updatedRequest);
    fetchSpy.mockResolvedValue(new Response(null, { status: 500 }));

    const actualResult = await service.answer('req-1', answerDto, craftsman);

    expect(actualResult.status).toBe(RequestStatus.ANSWERED);
    expect(actualResult.warning).toEqual(expect.any(String));
  });
});
