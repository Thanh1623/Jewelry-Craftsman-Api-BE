import { IsEnum, IsOptional } from 'class-validator';
import { RequestStatus } from '@prisma/client';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
