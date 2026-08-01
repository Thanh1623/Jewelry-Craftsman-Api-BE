import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
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

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  productImageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  referenceImageUrl?: string | null;

  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  customerNote?: string | null;

  @IsUrl({ require_tld: false })
  replyWebhookUrl!: string;
}
