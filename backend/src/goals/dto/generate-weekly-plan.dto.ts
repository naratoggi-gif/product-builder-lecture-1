import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateWeeklyPlanDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  weeks?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  targetCount?: number = 4;
}
