import { Module } from '@nestjs/common';
import { StepQuestController } from './stepquest.controller';
import { StepQuestService } from './stepquest.service';

@Module({
  controllers: [StepQuestController],
  providers: [StepQuestService],
  exports: [StepQuestService],
})
export class StepQuestModule {}
