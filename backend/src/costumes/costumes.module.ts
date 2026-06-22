import { Module } from '@nestjs/common';
import { CostumesController } from './costumes.controller';
import { CostumesService } from './costumes.service';

@Module({
  controllers: [CostumesController],
  providers: [CostumesService],
})
export class CostumesModule {}
