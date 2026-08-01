import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CraftsmanRequest, PushSubscription } from '@prisma/client';
import * as webpush from 'web-push';

import { PrismaService } from '../prisma/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapidPublicKey?: string;
  private readonly vapidConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>(
      'VAPID_SUBJECT',
      'mailto:demo@jewelry.local',
    );

    this.vapidPublicKey = publicKey;
    this.vapidConfigured = Boolean(publicKey && privateKey);

    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys are not configured — web push is disabled.');
    }
  }

  getVapidPublicKey(): { publicKey: string } {
    return { publicKey: this.vapidPublicKey ?? '' };
  }

  subscribe(
    userId: string,
    dto: SubscribeDto,
  ): Promise<Pick<PushSubscription, 'id' | 'endpoint' | 'createdAt'>> {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      select: { id: true, endpoint: true, createdAt: true },
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async notifyNewRequest(request: CraftsmanRequest): Promise<void> {
    if (!this.vapidConfigured) {
      this.logger.warn(
        `Skipping web push for request ${request.id} — VAPID keys empty.`,
      );
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany();
    if (subscriptions.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      title: 'Yêu cầu tư vấn mới',
      body: `${request.productName}: ${request.question}`,
      requestId: request.id,
    });

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendAndPrune(subscription, payload),
      ),
    );
  }

  private async sendAndPrune(
    subscription: PushSubscription,
    payload: string,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      );
    } catch (error) {
      const statusCode =
        error instanceof webpush.WebPushError ? error.statusCode : undefined;
      this.logger.warn(
        `Push failed for subscription ${subscription.id}: ${(error as Error).message}`,
      );
      // ponytail: gone/expired subscriptions (410/404) are pruned; other errors just log
      if (statusCode === 404 || statusCode === 410) {
        await this.prisma.pushSubscription
          .delete({ where: { id: subscription.id } })
          .catch(() => undefined);
      }
    }
  }
}
