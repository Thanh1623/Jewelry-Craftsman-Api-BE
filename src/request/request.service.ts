import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CraftsmanRequest,
  Prisma,
  RequestMessage,
  RequestMessageSender,
  RequestStatus,
} from '@prisma/client';

import {
  buildPaginatedMeta,
  PaginatedMeta,
} from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AnswerRequestDto } from './dto/answer-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { PostRequestMessageDto } from './dto/post-request-message.dto';
import { mapRequestToReplyWebhookPayload } from './mappers/reply-webhook.mapper';

export type RequestWithMessages = CraftsmanRequest & {
  messages: RequestMessage[];
};

export interface AnsweredRequestResponse extends RequestWithMessages {
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

  async getById(id: string): Promise<RequestWithMessages> {
    const request = await this.prisma.craftsmanRequest.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu tư vấn.');
    }

    if (request.messages.length === 0) {
      await this.seedThreadFromRequest(request);
      const seeded = await this.prisma.craftsmanRequest.findUnique({
        where: { id },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!seeded) {
        throw new NotFoundException('Không tìm thấy yêu cầu tư vấn.');
      }
      return seeded;
    }

    return request;
  }

  async updateStatus(
    id: string,
    status: RequestStatus,
  ): Promise<RequestWithMessages> {
    const existing = await this.getById(id);

    if (status === RequestStatus.IN_PROGRESS) {
      if (existing.status === RequestStatus.ANSWERED) {
        throw new BadRequestException('Yêu cầu đã hoàn thành, không nhận lại.');
      }
      if (existing.status === RequestStatus.IN_PROGRESS) {
        return existing;
      }
    } else if (status === RequestStatus.PENDING) {
      if (existing.status === RequestStatus.ANSWERED) {
        throw new BadRequestException('Không mở lại yêu cầu đã trả lời.');
      }
    } else if (status === RequestStatus.ANSWERED) {
      throw new BadRequestException(
        'Dùng API trả lời / gửi về shop để đánh dấu hoàn thành.',
      );
    }

    await this.prisma.craftsmanRequest.update({
      where: { id },
      data: { status },
    });
    return this.getById(id);
  }

  async postMessage(
    id: string,
    dto: PostRequestMessageDto,
    craftsman: { sub: string; fullName: string },
  ): Promise<RequestWithMessages | AnsweredRequestResponse> {
    const existing = await this.getById(id);
    if (existing.status === RequestStatus.ANSWERED) {
      throw new BadRequestException('Yêu cầu này đã được trả lời.');
    }

    const content =
      dto.content?.trim() ||
      (dto.imageUrl ? '[Ảnh đính kèm]' : '');
    if (!content) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống.');
    }

    await this.prisma.requestMessage.create({
      data: {
        requestId: id,
        sender: RequestMessageSender.CRAFTSMAN,
        senderId: craftsman.sub,
        content,
        imageUrl: dto.imageUrl ?? null,
      },
    });

    // Auto-promote when craftsman starts working (message / progress photo)
    if (existing.status === RequestStatus.PENDING && !dto.sendToShop) {
      await this.prisma.craftsmanRequest.update({
        where: { id },
        data: { status: RequestStatus.IN_PROGRESS },
      });
    }

    if (dto.sendToShop) {
      return this.answer(
        id,
        { answer: content },
        craftsman,
      );
    }

    return this.getById(id);
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

    // Ensure the final answer appears in the thread if it isn't the last craftsman msg
    const lastCraftsman = [...existing.messages]
      .reverse()
      .find((message) => message.sender === RequestMessageSender.CRAFTSMAN);
    if (!lastCraftsman || lastCraftsman.content !== dto.answer) {
      await this.prisma.requestMessage.create({
        data: {
          requestId: id,
          sender: RequestMessageSender.CRAFTSMAN,
          senderId: craftsman.sub,
          content: dto.answer,
        },
      });
    }

    const updated = await this.prisma.craftsmanRequest.update({
      where: { id },
      data: {
        status: RequestStatus.ANSWERED,
        answer: dto.answer,
        answeredById: craftsman.sub,
        answeredAt,
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
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

  /** Seed messenger thread from shop ask payload / legacy rows. */
  async seedThreadFromRequest(
    request: CraftsmanRequest,
    options?: { forceNewShopBubble?: boolean },
  ): Promise<void> {
    const existingCount = await this.prisma.requestMessage.count({
      where: { requestId: request.id },
    });
    if (existingCount > 0 && !options?.forceNewShopBubble) {
      return;
    }

    const rows: Prisma.RequestMessageCreateManyInput[] = [];

    const productBits = [
      request.productName,
      `${request.productWeightGrams}g`,
      `Công ${request.productLaborCost.toLocaleString('vi-VN')}đ`,
      request.productBaseSize != null ? `Size ${request.productBaseSize}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    rows.push({
      requestId: request.id,
      sender: RequestMessageSender.SHOP,
      content: productBits,
      imageUrl: request.productImageUrl,
    });

    rows.push({
      requestId: request.id,
      sender: RequestMessageSender.SHOP,
      content: request.question,
      imageUrl:
        request.referenceImageUrl &&
        request.referenceImageUrl !== request.productImageUrl
          ? request.referenceImageUrl
          : null,
    });

    if (request.customerNote?.trim()) {
      rows.push({
        requestId: request.id,
        sender: RequestMessageSender.SHOP,
        content: `Ghi chú sale: ${request.customerNote.trim()}`,
      });
    }

    if (request.status === RequestStatus.ANSWERED && request.answer) {
      rows.push({
        requestId: request.id,
        sender: RequestMessageSender.CRAFTSMAN,
        senderId: request.answeredById,
        content: request.answer,
        createdAt: request.answeredAt ?? undefined,
      });
    }

    if (rows.length > 0) {
      await this.prisma.requestMessage.createMany({ data: rows });
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
