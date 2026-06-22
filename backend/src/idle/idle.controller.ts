import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUserId } from '../shared/current-user-id.decorator';
import { IdleService } from './idle.service';

@Controller('idle')
export class IdleController {
  constructor(private readonly idleService: IdleService) {}

  @Get('status')
  getStatus(@CurrentUserId() userId: number) {
    return this.idleService.getStatus(userId);
  }

  @Post('stage/:id/select')
  selectStage(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) stageId: number) {
    return this.idleService.selectStage(userId, stageId);
  }

  @Post('claim')
  claim(@CurrentUserId() userId: number) {
    return this.idleService.claim(userId);
  }
}
