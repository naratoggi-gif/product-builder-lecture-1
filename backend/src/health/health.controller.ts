import { Controller, Get } from '@nestjs/common';
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
  }> {
    let database: 'connected' | 'unavailable' = 'connected';
    try {
      await this.db.query('SELECT 1');
    } catch {
      database = 'unavailable';
    }

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      version: appVersion(),
      commit: commitSha(),
    };
  }
}
