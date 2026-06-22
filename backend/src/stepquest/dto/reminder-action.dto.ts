import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReminderActionDto {
  @IsIn(['complete', 'snooze', 'shrink', 'skip'])
  action!: 'complete' | 'snooze' | 'shrink' | 'skip';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes?: number;
}
