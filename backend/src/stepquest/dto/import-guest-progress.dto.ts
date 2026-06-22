import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ImportGuestProgressDto {
  @IsString()
  @MaxLength(160)
  migrationId!: string;

  @IsObject()
  guestState!: Record<string, unknown>;

  @IsOptional()
  @IsIn(['import_guest', 'keep_account', 'merge'])
  choice?: 'import_guest' | 'keep_account' | 'merge';
}
