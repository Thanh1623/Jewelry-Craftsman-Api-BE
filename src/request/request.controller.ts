import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CraftsmanRequest } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginatedMeta } from '../common/dto/pagination-query.dto';
import type { JwtPayloadUser } from '../common/interfaces/jwt-payload.interface';
import { AnswerRequestDto } from './dto/answer-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { AnsweredRequestResponse, RequestService } from './request.service';

@ApiBearerAuth()
@ApiTags('Requests')
@Controller('requests')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Get()
  list(
    @Query() query: ListRequestsQueryDto,
  ): Promise<{ data: CraftsmanRequest[]; meta: PaginatedMeta }> {
    return this.requestService.list(query);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<CraftsmanRequest> {
    return this.requestService.getById(id);
  }

  @Post(':id/answer')
  answer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerRequestDto,
    @CurrentUser() user: JwtPayloadUser,
  ): Promise<AnsweredRequestResponse> {
    return this.requestService.answer(id, dto, {
      sub: user.sub,
      fullName: user.fullName,
    });
  }
}
