import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';
import { PredictionRequestDto } from './dto/prediction-request.dto';

@Injectable()
export class PredictionService {
  constructor(private readonly db: DatabaseService) {}

  async score(userId: number, input: PredictionRequestDto) {
    const base = 100;
    const timePenalty = Math.min(input.durationMin * 0.6, 30);
    const difficultyPenalty = (input.difficulty - 1) * 8;
    const historyBonus = input.historicalSuccessRate * 20;
    const timeslotBonus = input.timeslotSuccessRate * 10;
    const fatiguePenalty = input.fatigueLevel * 5;

    const raw = base - timePenalty - difficultyPenalty - fatiguePenalty + historyBonus + timeslotBonus;
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    const bucket = score >= 70 ? 'GOOD' : score >= 40 ? 'MEDIUM' : 'LOW';

    const suggestedDownscale =
      bucket === 'GOOD'
        ? null
        : {
            title: '지금 10초만 시작하기',
            estimatedSeconds: Math.max(10, Math.floor(input.durationMin * 60 * 0.5)),
          };

    await this.db.query(
      `INSERT INTO goal_prediction_snapshots
         (user_id, goal_type, target_id, score, duration_min, difficulty, historical_success_rate, timeslot_success_rate, fatigue_level, suggested_downscale_json)
       VALUES ($1, 'MICRO', 0, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        score,
        input.durationMin,
        input.difficulty,
        input.historicalSuccessRate,
        input.timeslotSuccessRate,
        input.fatigueLevel,
        suggestedDownscale ? JSON.stringify(suggestedDownscale) : null,
      ],
    );

    return { score, bucket, suggestedDownscale };
  }
}
