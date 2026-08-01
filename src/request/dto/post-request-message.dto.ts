import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class PostRequestMessageDto {
  @ValidateIf((dto: PostRequestMessageDto) => !dto.imageUrl)
  @IsString()
  @MinLength(1, { message: 'Nội dung tin nhắn không được để trống.' })
  content?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** true = lưu tin + gửi trả lời về shop (đóng yêu cầu). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  sendToShop?: boolean;
}
