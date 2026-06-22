import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillEffectsService } from './skill-effects.service';
import { SkillsService } from './skills.service';

@Module({
  controllers: [SkillsController],
  providers: [SkillsService, SkillEffectsService],
  exports: [SkillsService, SkillEffectsService],
})
export class SkillsModule {}
