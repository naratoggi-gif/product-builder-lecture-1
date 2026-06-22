import { IsIn, IsOptional } from 'class-validator';

export class RegenerateChainDto {
  @IsOptional()
  @IsIn(['too_big', 'no_material', 'unclear', 'tired', 'wrong_place', 'not_now', 'forgot', 'anxious'])
  reason?: string = 'too_big';
}
