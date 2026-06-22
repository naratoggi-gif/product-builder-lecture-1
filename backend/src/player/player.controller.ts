import { Controller, Get } from '@nestjs/common';
import { CurrentUserId } from '../shared/current-user-id.decorator';
import { PlayerService } from './player.service';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('me')
  getMe(@CurrentUserId() userId: number) {
    return this.playerService.getMe(userId);
  }

  @Get('currency')
  getCurrency(@CurrentUserId() userId: number) {
    return this.playerService.getCurrency(userId);
  }
}
