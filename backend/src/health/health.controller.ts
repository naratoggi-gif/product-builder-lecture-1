import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { appVersion, commitSha } from '../shared/app-version';
import { DatabaseService } from '../shared/database.service';
import { Public } from '../shared/public.decorator';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async getHealth(): Promise<{
    status: 'ok' | 'degraded';
    database: 'connected' | 'unavailable';
    version: string;
    commit: string;
    environment: string;
  }> {
    let database: 'connected' | 'unavailable' = 'connected';
    try {
      await this.db.query('SELECT 1');
    } catch {
      database = 'unavailable';
    }

    const payload = {
      status: database === 'connected' ? 'ok' as const : 'degraded' as const,
      database,
      version: appVersion(),
      commit: commitSha(),
      environment: process.env.NODE_ENV || 'development',
    };

    if (database !== 'connected') {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
