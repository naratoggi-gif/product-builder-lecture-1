import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/skills.module';
import { IdleController } from './idle.controller';
import { IdleService } from './idle.service';

@Module({
  imports: [SkillsModule],
  controllers: [IdleController],
  providers: [IdleService],
})
export class IdleModule {}
