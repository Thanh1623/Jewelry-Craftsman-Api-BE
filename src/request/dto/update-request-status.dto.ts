import { IsEnum } from 'class-validator';
import { RequestStatus } from '@prisma/client';

export class UpdateRequestStatusDto {
  @IsEnum(RequestStatus, {
    message: 'status phải là PENDING | IN_PROGRESS | ANSWERED.',
  })
  status!: RequestStatus;
}
