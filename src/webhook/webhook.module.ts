import { Module } from '@nestjs/common';

import { PushModule } from '../push/push.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [PushModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
