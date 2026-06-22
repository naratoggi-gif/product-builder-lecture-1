import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUserId } from '../shared/current-user-id.decorator';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get('shop')
  listShop(@CurrentUserId() userId: number) {
    return this.skillsService.listShop(userId);
  }

  @Post(':id/unlock')
  unlock(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.skillsService.unlock(userId, id);
  }

  @Post(':id/upgrade')
  upgrade(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.skillsService.upgrade(userId, id);
  }
}
