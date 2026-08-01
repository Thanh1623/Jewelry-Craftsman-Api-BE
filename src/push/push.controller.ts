import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PushSubscription } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayloadUser } from '../common/interfaces/jwt-payload.interface';
import { SubscribeDto } from './dto/subscribe.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { PushService } from './push.service';

@ApiTags('Push')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Public()
  @Get('vapid-public-key')
  getVapidPublicKey(): { publicKey: string } {
    return this.pushService.getVapidPublicKey();
  }

  @ApiBearerAuth()
  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  subscribe(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: SubscribeDto,
  ): Promise<Pick<PushSubscription, 'id' | 'endpoint' | 'createdAt'>> {
    return this.pushService.subscribe(user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(@Body() dto: UnsubscribeDto): Promise<void> {
    return this.pushService.unsubscribe(dto.endpoint);
  }
}
