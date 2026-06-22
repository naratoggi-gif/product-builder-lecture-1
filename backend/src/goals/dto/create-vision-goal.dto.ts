import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVisionGoalDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  targetDate!: string;
}
