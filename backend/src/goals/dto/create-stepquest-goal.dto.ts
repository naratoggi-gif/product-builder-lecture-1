import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateStepQuestGoalDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsIn(['auto', 'study', 'work', 'writing', 'cleaning', 'exercise', 'wake', 'sleep', 'life_admin', 'relationship'])
  category?: string = 'auto';

  @IsInt()
  @Min(1)
  @Max(4)
  burdenLevel!: 1 | 2 | 3 | 4;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  energyLevel?: 'low' | 'medium' | 'high' = 'medium';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  obstacle?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}
