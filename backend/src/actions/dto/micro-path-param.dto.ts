import { IsInt, Min } from 'class-validator';

export class MicroPathParamDto {
  @IsInt()
  @Min(1)
  id!: number;
}
