import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateMicroActionsDto {
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  count?: number = 3;
}
