import { Module } from '@nestjs/common';

import { RequestModule } from '../request/request.module';
import { PushModule } from '../push/push.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [PushModule, RequestModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
