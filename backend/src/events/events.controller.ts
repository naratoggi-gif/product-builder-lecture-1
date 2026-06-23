import { Body, Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../shared/public.decorator';
import { TrackProductEventDto } from './dto/track-product-event.dto';
import { EventsService } from './events.service';

type RequestWithUser = Request & { user?: { sub?: number; userId?: number } };

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post('track')
  track(@Req() request: RequestWithUser, @Body() body: TrackProductEventDto): Promise<{ ok: true }> {
    return this.eventsService.track(body, Number(request.user?.sub || request.user?.userId) || null);
  }
}
