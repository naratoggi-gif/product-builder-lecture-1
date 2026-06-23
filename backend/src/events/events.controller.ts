import { Body, Controller, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../shared/public.decorator';
import { TrackProductEventDto } from './dto/track-product-event.dto';
import { EventsService } from './events.service';

type RequestWithUser = Request & { user?: { sub?: number; userId?: number } };

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post('track')
  async track(@Req() request: RequestWithUser, @Body() body: TrackProductEventDto): Promise<{ ok: true }> {
    return this.eventsService.track(body, await this.optionalUserId(request));
  }

  private async optionalUserId(request: RequestWithUser): Promise<number | null> {
    const existing = Number(request.user?.sub || request.user?.userId) || null;
    if (existing) return existing;

    const raw = request.headers?.authorization;
    const authHeader = Array.isArray(raw) ? raw[0] : raw;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    try {
      const payload = await this.jwtService.verifyAsync(authHeader.slice('Bearer '.length).trim(), {
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      });
      return Number(payload?.sub || payload?.userId) || null;
    } catch {
      return null;
    }
  }
}
