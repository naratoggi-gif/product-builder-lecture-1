import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}
