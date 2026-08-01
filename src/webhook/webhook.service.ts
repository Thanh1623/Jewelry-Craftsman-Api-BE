import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { RequestService } from '../request/request.service';
import { AskCraftsmanDto } from './dto/ask-craftsman.dto';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly pushService: PushService,
    private readonly requestService: RequestService,
  ) {}

  async handleAskCraftsman(
    secret: string | undefined,
    dto: AskCraftsmanDto,
  ): Promise<{ ok: true; id: string }> {
    this.assertValidSecret(secret);

    const data = {
      chatSessionId: dto.chatSessionId,
      productId: dto.productId ?? null,
      productName: dto.productName,
      productWeightGrams: dto.productWeightGrams,
      productLaborCost: dto.productLaborCost,
      productBaseSize: dto.productBaseSize ?? null,
      productImageUrl: dto.productImageUrl ?? null,
      referenceImageUrl: dto.referenceImageUrl ?? null,
      question: dto.question,
      customerNote: dto.customerNote ?? null,
      replyWebhookUrl: dto.replyWebhookUrl,
    };

    const request = await this.prisma.craftsmanRequest.upsert({
      where: { shopRequestId: dto.requestId },
      create: { shopRequestId: dto.requestId, ...data },
      update: data,
    });

    const messageCount = await this.prisma.requestMessage.count({
      where: { requestId: request.id },
    });
    if (messageCount === 0) {
      await this.requestService.seedThreadFromRequest(request);
    }

    if (request.status === RequestStatus.PENDING) {
      await this.pushService.notifyNewRequest(request);
    }

    return { ok: true, id: request.id };
  }

  private assertValidSecret(secret: string | undefined): void {
    const expectedSecret = this.configService.get<string>('WEBHOOK_SECRET');
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Webhook secret không hợp lệ.');
    }
  }
}
