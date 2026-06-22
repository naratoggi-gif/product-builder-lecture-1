import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUserId } from '../shared/current-user-id.decorator';
import { CreateStepQuestGoalDto } from './dto/create-stepquest-goal.dto';
import { ImportGuestProgressDto } from './dto/import-guest-progress.dto';
import { ReminderActionDto } from './dto/reminder-action.dto';
import { RegenerateChainDto } from './dto/regenerate-chain.dto';
import { SaveReminderDto } from './dto/save-reminder.dto';
import { ShrinkStepDto } from './dto/shrink-step.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { StepQuestService } from './stepquest.service';

@Controller('stepquest')
export class StepQuestController {
  constructor(private readonly stepQuestService: StepQuestService) {}

  @Post('goals')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  createGoal(@CurrentUserId() userId: number, @Body() body: CreateStepQuestGoalDto): Promise<unknown> {
    return this.stepQuestService.createGoal(userId, body);
  }

  @Post('guest/import')
  @Throttle({ default: { ttl: 600_000, limit: 5 } })
  importGuestProgress(@CurrentUserId() userId: number, @Body() body: ImportGuestProgressDto): Promise<unknown> {
    return this.stepQuestService.importGuestProgress(userId, body);
  }

  @Get('current')
  getCurrent(@CurrentUserId() userId: number): Promise<unknown> {
    return this.stepQuestService.getCurrent(userId);
  }

  @Get('settings')
  getSettings(@CurrentUserId() userId: number): Promise<unknown> {
    return this.stepQuestService.getSettings(userId);
  }

  @Post('settings')
  updateSettings(@CurrentUserId() userId: number, @Body() body: UpdateUserSettingsDto): Promise<unknown> {
    return this.stepQuestService.updateSettings(userId, body);
  }

  @Get('stats')
  getStats(@CurrentUserId() userId: number): Promise<unknown> {
    return this.stepQuestService.getStats(userId);
  }

  @Get('dungeons')
  getDungeons(@CurrentUserId() userId: number): Promise<unknown> {
    return this.stepQuestService.getDungeons(userId);
  }

  @Post('goals/:id/pause')
  pauseGoal(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.stepQuestService.setGoalStatus(userId, id, 'paused');
  }

  @Post('goals/:id/resume')
  resumeGoal(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.stepQuestService.setGoalStatus(userId, id, 'active');
  }

  @Post('goals/:id/archive')
  archiveGoal(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.stepQuestService.setGoalStatus(userId, id, 'archived');
  }

  @Post('goals/:id/regenerate')
  regenerateGoal(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RegenerateChainDto,
  ): Promise<unknown> {
    return this.stepQuestService.regenerateChain(userId, id, body?.reason);
  }

  @Get('reminder')
  getReminder(@CurrentUserId() userId: number): Promise<unknown> {
    return this.stepQuestService.getReminder(userId);
  }

  @Post('reminder')
  saveReminder(@CurrentUserId() userId: number, @Body() body: SaveReminderDto): Promise<unknown> {
    return this.stepQuestService.saveReminder(userId, body);
  }

  @Post('reminder/action')
  handleReminderAction(@CurrentUserId() userId: number, @Body() body: ReminderActionDto): Promise<unknown> {
    return this.stepQuestService.handleReminderAction(userId, body);
  }

  @Get('costumes')
  getCostumes(@CurrentUserId() userId: number): Promise<unknown> {
    return this.stepQuestService.getCostumes(userId);
  }

  @Post('costumes/:id/equip')
  equipCostume(@CurrentUserId() userId: number, @Param('id') id: string): Promise<unknown> {
    return this.stepQuestService.equipCostume(userId, id);
  }

  @Post('costumes/:id/activate')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  activateCostume(@CurrentUserId() userId: number, @Param('id') id: string): Promise<unknown> {
    return this.stepQuestService.activateCostume(userId, id);
  }

  @Post('steps/:id/complete')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  completeStep(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('idempotencyKey') idempotencyKey?: string,
  ): Promise<unknown> {
    return this.stepQuestService.completeStep(userId, id, idempotencyKey);
  }

  @Post('steps/:id/undo')
  undoStepCompletion(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.stepQuestService.undoStepCompletion(userId, id);
  }

  @Post('steps/:id/shrink')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  shrinkStep(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ShrinkStepDto,
  ): Promise<unknown> {
    return this.stepQuestService.shrinkStep(userId, id, body.reason);
  }

  @Post('steps/:id/skip')
  skipStep(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.stepQuestService.skipStep(userId, id);
  }

  @Post('steps/:id/defer')
  deferStep(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ): Promise<unknown> {
    return this.stepQuestService.deferStep(userId, id, reason);
  }

  @Post('steps/:id/resume')
  resumeDeferredStep(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.stepQuestService.resumeDeferredStep(userId, id);
  }

  @Get('return/eligibility')
  getReturnEligibility(@CurrentUserId() userId: number): Promise<unknown> {
    return this.stepQuestService.getReturnEligibility(userId);
  }

  @Post('return/start')
  startReturnSession(@CurrentUserId() userId: number): Promise<unknown> {
    return this.stepQuestService.startReturnSession(userId);
  }
}
