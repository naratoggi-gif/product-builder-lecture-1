import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class PredictionRequestDto {
  @IsInt()
  @Min(0)
  durationMin!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  difficulty!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  historicalSuccessRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  timeslotSuccessRate!: number;

  @IsInt()
  @Min(0)
  @Max(5)
  fatigueLevel!: number;
}
