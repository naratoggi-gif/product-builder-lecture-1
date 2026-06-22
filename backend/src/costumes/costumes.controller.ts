import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CostumesService } from './costumes.service';
import { CurrentUserId } from '../shared/current-user-id.decorator';

@Controller()
export class CostumesController {
  constructor(private readonly costumesService: CostumesService) {}

  @Get('shop/costumes')
  listShop(@CurrentUserId() userId: number) {
    return this.costumesService.listShop(userId);
  }

  @Post('shop/costumes/:id/buy')
  buy(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.costumesService.buy(userId, id);
  }

  @Post('costumes/:id/equip')
  equip(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.costumesService.equip(userId, id);
  }
}
