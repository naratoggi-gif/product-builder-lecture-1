import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { ConsistencyModule } from './consistency/consistency.module';
import { CostumesModule } from './costumes/costumes.module';
import { DevtoolsModule } from './devtools/devtools.module';
import { GoalsModule } from './goals/goals.module';
import { HealthModule } from './health/health.module';
import { IdleModule } from './idle/idle.module';
import { PlayerModule } from './player/player.module';
import { PredictionModule } from './prediction/prediction.module';
import { JwtAuthGuard } from './shared/jwt-auth.guard';
import { SharedModule } from './shared/shared.module';
import { SkillsModule } from './skills/skills.module';
import { StepQuestModule } from './stepquest/stepquest.module';

@Module({
  imports: [SharedModule, AuthModule, PlayerModule, IdleModule, GoalsModule, ActionsModule, ConsistencyModule, PredictionModule, CostumesModule, SkillsModule, StepQuestModule, DevtoolsModule, HealthModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
