import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { AskCraftsmanDto } from './dto/ask-craftsman.dto';
import { WebhookService } from './webhook.service';

@ApiTags('Webhooks')
@Controller('webhooks/shop')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Public()
  @Post('ask-craftsman')
  @HttpCode(HttpStatus.OK)
  askCraftsman(
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() dto: AskCraftsmanDto,
  ): Promise<{ ok: true; id: string }> {
    return this.webhookService.handleAskCraftsman(secret, dto);
  }
}
