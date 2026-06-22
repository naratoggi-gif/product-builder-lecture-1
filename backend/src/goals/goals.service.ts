import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';
import {
  DecomposeGoalOutput,
  QuestCategory,
  decomposeGoal,
  difficultyForSeconds,
} from '../stepquest/stepquest.domain';
import { CreateStepQuestGoalDto } from './dto/create-stepquest-goal.dto';
import { CreateVisionGoalDto } from './dto/create-vision-goal.dto';

interface VisionRow {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  targetDate: string;
  status: 'OPEN' | 'DONE' | 'ARCHIVED';
  createdAt: string;
  completedAt: string | null;
}

interface WeeklyRow {
  id: number;
  visionGoalId: number;
  userId: number;
  title: string;
  weekStartDate: string;
  weekEndDate: string;
  targetCount: number;
  completedCount: number;
  status: 'OPEN' | 'DONE' | 'EXPIRED';
  createdAt: string;
  completedAt: string | null;
}

interface MicroRow {
  id: number;
  weeklyMissionId: number;
  userId: number;
  title: string;
  estimatedSeconds: number;
  difficulty: number;
  status: 'OPEN' | 'DONE' | 'SKIPPED' | 'FAILED';
  createdAt: string;
  completedAt: string | null;
}

@Injectable()
export class GoalsService {
  constructor(private readonly db: DatabaseService) {}

  async listVisionGoals(userId: number): Promise<VisionRow[]> {
    const result = await this.db.query<VisionRow>(
      `SELECT
         id,
         user_id AS "userId",
         title,
         description,
         target_date AS "targetDate",
         status,
         created_at AS "createdAt",
         completed_at AS "completedAt"
       FROM vision_goals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async listWeeklyMissions(userId: number, visionId?: number): Promise<WeeklyRow[]> {
    const params: unknown[] = [userId];
    let where = 'WHERE user_id = $1';

    if (visionId !== undefined && Number.isInteger(visionId)) {
      params.push(visionId);
      where += ` AND vision_goal_id = $${params.length}`;
    }

    const result = await this.db.query<WeeklyRow>(
      `SELECT
         id,
         vision_goal_id AS "visionGoalId",
         user_id AS "userId",
         title,
         week_start_date AS "weekStartDate",
         week_end_date AS "weekEndDate",
         target_count AS "targetCount",
         completed_count AS "completedCount",
         status,
         created_at AS "createdAt",
         completed_at AS "completedAt"
       FROM weekly_missions
       ${where}
       ORDER BY week_start_date DESC, id DESC`,
      params,
    );

    return result.rows;
  }

  async listMicroActions(userId: number, weeklyId: number): Promise<MicroRow[]> {
    const result = await this.db.query<MicroRow>(
      `SELECT
         id,
         weekly_mission_id AS "weeklyMissionId",
         user_id AS "userId",
         title,
         estimated_seconds AS "estimatedSeconds",
         difficulty,
         status,
         created_at AS "createdAt",
         completed_at AS "completedAt"
       FROM micro_actions
       WHERE user_id = $1 AND weekly_mission_id = $2
       ORDER BY id ASC`,
      [userId, weeklyId],
    );

    return result.rows;
  }

  async createVision(userId: number, body: CreateVisionGoalDto): Promise<VisionRow> {
    const result = await this.db.query<VisionRow>(
      `INSERT INTO vision_goals (user_id, title, description, target_date)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         user_id AS "userId",
         title,
         description,
         target_date AS "targetDate",
         status,
         created_at AS "createdAt",
         completed_at AS "completedAt"`,
      [userId, body.title, body.description ?? null, body.targetDate],
    );

    return result.rows[0];
  }

  async createStepQuestGoal(userId: number, body: CreateStepQuestGoalDto) {
    const output = decomposeGoal({
      goalTitle: body.title,
      category: body.category as QuestCategory | 'auto' | undefined,
      burdenLevel: body.burdenLevel,
      energyLevel: body.energyLevel ?? 'medium',
    });
    const start = this.dateKey(0);
    const end = this.dateKey(6);
    const targetDate = body.targetDate ?? end;
    const description = this.descriptionFor(output, body);

    return this.db.withTransaction(async (client) => {
      const vision = await client.query<VisionRow>(
        `INSERT INTO vision_goals (user_id, title, description, target_date)
         VALUES ($1, $2, $3, $4)
         RETURNING
           id,
           user_id AS "userId",
           title,
           description,
           target_date AS "targetDate",
           status,
           created_at AS "createdAt",
           completed_at AS "completedAt"`,
        [userId, output.normalizedGoal, description, targetDate],
      );

      const weekly = await client.query<WeeklyRow>(
        `INSERT INTO weekly_missions
           (vision_goal_id, user_id, title, week_start_date, week_end_date, target_count, completed_count)
         VALUES ($1, $2, $3, $4, $5, $6, 0)
         RETURNING
           id,
           vision_goal_id AS "visionGoalId",
           user_id AS "userId",
           title,
           week_start_date AS "weekStartDate",
           week_end_date AS "weekEndDate",
           target_count AS "targetCount",
           completed_count AS "completedCount",
           status,
           created_at AS "createdAt",
           completed_at AS "completedAt"`,
        [vision.rows[0].id, userId, output.chainTitle, start, end, output.steps.length],
      );

      const microActions: MicroRow[] = [];
      for (const step of output.steps) {
        const inserted = await client.query<MicroRow>(
          `INSERT INTO micro_actions (weekly_mission_id, user_id, title, estimated_seconds, difficulty)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING
             id,
             weekly_mission_id AS "weeklyMissionId",
             user_id AS "userId",
             title,
             estimated_seconds AS "estimatedSeconds",
             difficulty,
             status,
             created_at AS "createdAt",
             completed_at AS "completedAt"`,
          [weekly.rows[0].id, userId, step.title, step.estimatedSeconds, difficultyForSeconds(step.estimatedSeconds)],
        );
        microActions.push(inserted.rows[0]);
      }

      return {
        vision: vision.rows[0],
        weeklyMission: weekly.rows[0],
        microActions,
        firstStep: microActions[0],
        category: output.category,
        message: output.message,
      };
    });
  }

  async generateWeeklyPlan(userId: number, visionId: number, weeks = 1, targetCount = 4): Promise<WeeklyRow[]> {
    const vision = await this.db.query<{ id: number; title: string }>(
      'SELECT id, title FROM vision_goals WHERE id = $1 AND user_id = $2',
      [visionId, userId],
    );

    if (!vision.rowCount) {
      throw new NotFoundException('Vision goal not found.');
    }

    const created: WeeklyRow[] = [];
    const baseDate = new Date();

    for (let i = 0; i < weeks; i += 1) {
      const start = new Date(baseDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);

      const inserted = await this.db.query<WeeklyRow>(
        `INSERT INTO weekly_missions
           (vision_goal_id, user_id, title, week_start_date, week_end_date, target_count, completed_count)
         VALUES ($1, $2, $3, $4, $5, $6, 0)
         RETURNING
           id,
           vision_goal_id AS "visionGoalId",
           user_id AS "userId",
           title,
           week_start_date AS "weekStartDate",
           week_end_date AS "weekEndDate",
           target_count AS "targetCount",
           completed_count AS "completedCount",
           status,
           created_at AS "createdAt",
           completed_at AS "completedAt"`,
        [
          visionId,
          userId,
          `${vision.rows[0].title} ${i + 1}\uC8FC\uCC28`,
          start.toISOString().slice(0, 10),
          end.toISOString().slice(0, 10),
          targetCount,
        ],
      );

      created.push(inserted.rows[0]);
    }

    return created;
  }

  async generateMicroActions(userId: number, weeklyId: number, count = 3): Promise<MicroRow[]> {
    const weekly = await this.db.query<{ id: number; title: string }>(
      'SELECT id, title FROM weekly_missions WHERE id = $1 AND user_id = $2',
      [weeklyId, userId],
    );

    if (!weekly.rowCount) {
      throw new NotFoundException('Weekly mission not found.');
    }

    const output = decomposeGoal({
      goalTitle: weekly.rows[0].title,
      category: 'auto',
      burdenLevel: 4,
      energyLevel: 'medium',
    });
    const templates = output.steps.slice(0, count);
    const created: MicroRow[] = [];

    for (const step of templates) {
      const inserted = await this.db.query<MicroRow>(
        `INSERT INTO micro_actions (weekly_mission_id, user_id, title, estimated_seconds, difficulty)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
           id,
           weekly_mission_id AS "weeklyMissionId",
           user_id AS "userId",
           title,
           estimated_seconds AS "estimatedSeconds",
           difficulty,
           status,
           created_at AS "createdAt",
           completed_at AS "completedAt"`,
        [weeklyId, userId, step.title, step.estimatedSeconds, difficultyForSeconds(step.estimatedSeconds)],
      );
      created.push(inserted.rows[0]);
    }

    return created;
  }

  private descriptionFor(output: DecomposeGoalOutput, body: CreateStepQuestGoalDto): string {
    return [
      'STEPQUEST',
      `category:${output.category}`,
      `burden:${body.burdenLevel}`,
      `energy:${body.energyLevel ?? 'medium'}`,
      body.obstacle ? `obstacle:${body.obstacle}` : '',
    ].filter(Boolean).join(' | ');
  }

  private dateKey(daysFromToday: number): string {
    const date = new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }
}
