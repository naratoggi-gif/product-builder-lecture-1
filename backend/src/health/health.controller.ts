import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';
import { Public } from '../shared/public.decorator';

const APP_VERSION = '0.1.0-alpha';

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
      version: process.env.APP_VERSION || APP_VERSION,
      commit: process.env.GIT_SHA || process.env.COMMIT_SHA || 'local',
    };
  }
}
