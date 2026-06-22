import { Controller, Get, Post } from '@nestjs/common';
import { ConsistencyService } from './consistency.service';
import { CurrentUserId } from '../shared/current-user-id.decorator';

@Controller('consistency')
export class ConsistencyController {
  constructor(private readonly consistencyService: ConsistencyService) {}

  @Get('me')
  getMe(@CurrentUserId() userId: number) {
    return this.consistencyService.getState(userId);
  }

  @Post('recover')
  recover(@CurrentUserId() userId: number) {
    return this.consistencyService.recover(userId);
  }
}
