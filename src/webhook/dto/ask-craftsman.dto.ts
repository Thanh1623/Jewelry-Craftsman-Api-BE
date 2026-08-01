import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class AskCraftsmanDto {
  @IsUUID()
  requestId!: string;

  @IsUUID()
  chatSessionId!: string;

  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @IsString()
  productName!: string;

  @IsNumber()
  productWeightGrams!: number;

  @IsInt()
  productLaborCost!: number;

  @IsOptional()
  @IsInt()
  productBaseSize?: number | null;

  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  customerNote?: string | null;

  @IsUrl({ require_tld: false })
  replyWebhookUrl!: string;
}
