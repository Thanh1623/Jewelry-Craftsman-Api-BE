import { IsString, MinLength } from 'class-validator';

export class AnswerRequestDto {
  @IsString()
  @MinLength(1, { message: 'Câu trả lời không được để trống.' })
  answer!: string;
}
