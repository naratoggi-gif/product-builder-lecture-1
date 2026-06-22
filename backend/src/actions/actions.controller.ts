import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUserId } from '../shared/current-user-id.decorator';
import { ActionsService } from './actions.service';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('next-micro')
  getNextMicro(@CurrentUserId() userId: number): Promise<unknown> {
    return this.actionsService.getNextMicro(userId);
  }

  @Post('micro/:id/complete')
  completeMicro(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.actionsService.completeMicro(userId, id);
  }

  @Post('micro/:id/shrink')
  shrinkMicro(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ): Promise<unknown> {
    return this.actionsService.shrinkMicro(userId, id, reason);
  }

  @Post('micro/:id/skip')
  skipMicro(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number): Promise<unknown> {
    return this.actionsService.skipMicro(userId, id);
  }
}
