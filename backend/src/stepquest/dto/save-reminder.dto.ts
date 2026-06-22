import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SaveReminderDto {
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes!: number;

  @IsOptional()
  @IsInt()
  stepId?: number;
}
