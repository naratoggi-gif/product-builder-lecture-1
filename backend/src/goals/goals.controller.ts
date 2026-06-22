import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserId } from '../shared/current-user-id.decorator';
import { CreateStepQuestGoalDto } from './dto/create-stepquest-goal.dto';
import { CreateVisionGoalDto } from './dto/create-vision-goal.dto';
import { GenerateMicroActionsDto } from './dto/generate-micro-actions.dto';
import { GenerateWeeklyPlanDto } from './dto/generate-weekly-plan.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get('vision')
  listVision(@CurrentUserId() userId: number): Promise<unknown> {
    return this.goalsService.listVisionGoals(userId);
  }

  @Get('weekly')
  listWeekly(@CurrentUserId() userId: number, @Query('visionId') visionId?: string): Promise<unknown> {
    const parsed = visionId ? Number(visionId) : undefined;
    return this.goalsService.listWeeklyMissions(userId, parsed);
  }

  @Get('weekly/:id/micro')
  listMicro(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.goalsService.listMicroActions(userId, id);
  }

  @Post('vision')
  createVision(@CurrentUserId() userId: number, @Body() body: CreateVisionGoalDto): Promise<unknown> {
    return this.goalsService.createVision(userId, body);
  }

  @Post('stepquest')
  createStepQuest(@CurrentUserId() userId: number, @Body() body: CreateStepQuestGoalDto): Promise<unknown> {
    return this.goalsService.createStepQuestGoal(userId, body);
  }

  @Post('vision/:id/weekly-plan')
  generateWeeklyPlan(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: GenerateWeeklyPlanDto,
  ): Promise<unknown> {
    return this.goalsService.generateWeeklyPlan(userId, id, body.weeks, body.targetCount);
  }

  @Post('weekly/:id/micro-generate')
  generateMicroActions(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: GenerateMicroActionsDto,
  ): Promise<unknown> {
    return this.goalsService.generateMicroActions(userId, id, body.count);
  }
}
