import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CraftsmanRequest, Prisma, RequestStatus } from '@prisma/client';

import {
  buildPaginatedMeta,
  PaginatedMeta,
} from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AnswerRequestDto } from './dto/answer-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { mapRequestToReplyWebhookPayload } from './mappers/reply-webhook.mapper';

export interface AnsweredRequestResponse extends CraftsmanRequest {
  warning?: string;
}

@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async list(
    query: ListRequestsQueryDto,
  ): Promise<{ data: CraftsmanRequest[]; meta: PaginatedMeta }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CraftsmanRequestWhereInput = query.status
      ? { status: query.status }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.craftsmanRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.craftsmanRequest.count({ where }),
    ]);

    return { data, meta: buildPaginatedMeta(page, limit, total) };
  }

  async getById(id: string): Promise<CraftsmanRequest> {
    const request = await this.prisma.craftsmanRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu tư vấn.');
    }
    return request;
  }

  async answer(
    id: string,
    dto: AnswerRequestDto,
    craftsman: { sub: string; fullName: string },
  ): Promise<AnsweredRequestResponse> {
    const existing = await this.getById(id);
    if (existing.status === RequestStatus.ANSWERED) {
      throw new BadRequestException('Yêu cầu này đã được trả lời.');
    }

    const answeredAt = new Date();
    const updated = await this.prisma.craftsmanRequest.update({
      where: { id },
      data: {
        status: RequestStatus.ANSWERED,
        answer: dto.answer,
        answeredById: craftsman.sub,
        answeredAt,
      },
    });

    try {
      await this.notifyShop(updated, craftsman.fullName);
      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to notify shop webhook for request ${id}: ${(error as Error).message}`,
      );
      return {
        ...updated,
        warning:
          'Đã lưu câu trả lời nhưng không thể gửi thông báo về hệ thống shop.',
      };
    }
  }

  private async notifyShop(
    request: CraftsmanRequest,
    craftsmanName: string,
  ): Promise<void> {
    const payload = mapRequestToReplyWebhookPayload(request, craftsmanName);
    const response = await fetch(request.replyWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': this.configService.get<string>(
          'WEBHOOK_SECRET',
          '',
        ),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Shop webhook responded with status ${response.status}`);
    }
  }
}
