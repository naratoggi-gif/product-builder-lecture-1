import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const PRODUCT_EVENTS = [
  'app_opened',
  'goal_created',
  'first_step_shown',
  'step_completed',
  'step_undone',
  'step_shrunk',
  'step_skipped',
  'session_deferred',
  'return_offered',
  'return_started',
  'return_completed',
  'guest_import_completed',
  'goal_cleared',
] as const;

export class TrackProductEventDto {
  @IsIn(PRODUCT_EVENTS)
  eventName!: typeof PRODUCT_EVENTS[number];

  @IsString()
  @MaxLength(120)
  anonymousUserId!: string;

  @IsString()
  @MaxLength(120)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  goalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  stepId?: string;

  @IsOptional()
  @IsIn(['study', 'work', 'writing', 'cleaning', 'exercise', 'wake', 'sleep', 'life_admin', 'relationship'])
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1800)
  estimatedSeconds?: number;
}
