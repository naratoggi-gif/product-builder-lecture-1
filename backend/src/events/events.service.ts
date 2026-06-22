import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';
import { appVersion } from '../shared/app-version';
import { TrackProductEventDto } from './dto/track-product-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly db: DatabaseService) {}

  async track(input: TrackProductEventDto, userId?: number | null): Promise<{ ok: true }> {
    try {
      await this.db.query(
        `INSERT INTO product_events
           (event_name, anonymous_user_id, account_user_id, session_id, goal_id, step_id, category, estimated_seconds, app_version, environment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          input.eventName,
          input.anonymousUserId,
          userId || null,
          input.sessionId,
          input.goalId || null,
          input.stepId || null,
          input.category || null,
          input.estimatedSeconds || null,
          appVersion(),
          process.env.NODE_ENV || 'development',
        ],
      );
    } catch {
      // Product analytics must never block the execution helper UI.
    }
    return { ok: true };
  }
}
