import { IsIn, IsOptional } from 'class-validator';

export class ShrinkStepDto {
  @IsOptional()
  @IsIn(['too_big', 'no_material', 'unclear', 'tired', 'wrong_place', 'not_now', 'forgot', 'anxious', 'costume_active'])
  reason?: string = 'too_big';
}
