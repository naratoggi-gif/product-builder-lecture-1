import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService, SqlExecutor } from '../shared/database.service';
import {
  BurdenLevel,
  EnergyLevel,
  FailureReason,
  QuestGrade,
  QuestCategory,
  StepPhase,
  calculateStepReward,
  difficultyForSeconds,
  gradeForSeconds,
  shrinkStep,
} from './stepquest.domain';
import { createStepQuestDecomposer } from './stepquest.decomposer';
import { CreateStepQuestGoalDto } from './dto/create-stepquest-goal.dto';
import { ImportGuestProgressDto } from './dto/import-guest-progress.dto';
import { ReminderActionDto } from './dto/reminder-action.dto';
import { SaveReminderDto } from './dto/save-reminder.dto';

type FacilityKey =
  | 'knowledge_tower'
  | 'guild_office'
  | 'training_ground'
  | 'workshop'
  | 'archive'
  | 'inn'
  | 'kitchen'
  | 'garden';

interface CurrentStepRow {
  stepId: number;
  chainId: number;
  goalId: number;
  userId: number;
  title: string;
  successCriterion: string;
  phase: string;
  orderIndex: number;
  estimatedSeconds: number;
  grade: string;
  status: string;
  xpReward: number;
  facilityReward: number;
  category: QuestCategory;
  goalTitle: string;
  deferredAt?: string | null;
}

interface GuestImportGoal {
  sourceId: string;
  title: string;
  category: QuestCategory;
  burdenLevel: BurdenLevel;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt?: string | null;
  completedAt?: string | null;
}

interface GuestImportStep {
  sourceId: string;
  sourceGoalId: string;
  title: string;
  successCriterion: string;
  category: QuestCategory;
  phase: StepPhase;
  orderIndex: number;
  estimatedSeconds: number;
  grade: QuestGrade;
  status: 'pending' | 'active' | 'completed' | 'deferred' | 'skipped' | 'replaced';
  activatedAt?: string | null;
  completedAt?: string | null;
}

interface GuestImportAttempt {
  sourceStepId: string;
  action: 'complete' | 'shrink' | 'defer' | 'skip' | 'undo' | 'costume_active';
  reason?: string | null;
}

interface NormalizedGuestImport {
  goals: GuestImportGoal[];
  steps: GuestImportStep[];
  attempts: GuestImportAttempt[];
  equippedCostumeId: string;
  returnMarks: number;
}

const RETURN_MESSAGE = '\uB3CC\uC544\uC654\uB2E4. \uAE30\uB85D\uC740 \uB0A8\uC544 \uC788\uB2E4.';
const ONE_ACTION_MESSAGE = '\uC9C0\uAE08 \uD560 \uC77C\uC740 \uD558\uB098\uB2E4.';
const PROGRESS_KEPT_MESSAGE = '\uC9C4\uD589\uD55C \uAC83\uC740 \uC0AC\uB77C\uC9C0\uC9C0 \uC54A\uB294\uB2E4.';
const SHRINK_MESSAGE = '\uC774 \uB2E8\uACC4\uAC00 \uCEF8\uB2E4. \uB354 \uC791\uAC8C \uBC14\uAFC2\uB2E4.';
const STOP_MESSAGE = '\uC5EC\uAE30\uC11C \uBA48\uCDB0\uB3C4 \uC9C4\uD589\uD55C \uAC83\uC740 \uC0AC\uB77C\uC9C0\uC9C0 \uC54A\uB294\uB2E4.';
const RETURN_STEP_TITLE = '\uC9C0\uB09C \uBAA9\uD45C \uC81C\uBAA9 \uD55C \uBC88 \uBCF4\uAE30';
const RETURN_STEP_SUCCESS = '\uC81C\uBAA9 \uD655\uC778 \uC644\uB8CC';
const COSTUME_ACTIVE_RECHARGE_STEPS = 3;

function isSuperModeAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_SUPER_MODE === 'true';
}

const FACILITY_BY_CATEGORY: Record<QuestCategory, FacilityKey> = {
  study: 'knowledge_tower',
  work: 'guild_office',
  writing: 'archive',
  cleaning: 'workshop',
  exercise: 'training_ground',
  wake: 'inn',
  sleep: 'inn',
  life_admin: 'guild_office',
  relationship: 'garden',
};

const FACILITIES: FacilityKey[] = [
  'knowledge_tower',
  'guild_office',
  'training_ground',
  'workshop',
  'archive',
  'inn',
  'kitchen',
  'garden',
];

const DUNGEON_THEME_BY_CATEGORY: Record<QuestCategory, string> = {
  study: 'library_ruins',
  work: 'guild_contract',
  writing: 'blank_archive',
  cleaning: 'dust_workshop',
  exercise: 'training_field',
  wake: 'dawn_gate',
  sleep: 'quiet_inn',
  life_admin: 'paper_citadel',
  relationship: 'message_garden',
};

type CostumeUnlockMetric = 'always' | 'category_completed' | 'return_sessions' | 'total_completed';

interface StepQuestCostumeDefinition {
  id: string;
  name: string;
  role: string;
  passiveAbility: string;
  activeAbility: string;
  unlockText: string;
  metric: CostumeUnlockMetric;
  category?: QuestCategory;
  target: number;
}

interface CostumeAbilityStepTemplate {
  title: string;
  seconds: number;
  phase: 'orient' | 'prepare' | 'open' | 'start' | 'continue' | 'close';
}

interface CostumeProgress {
  categoryCompleted: Record<string, number>;
  completedSteps: number;
  returnSessions: number;
}

interface CostumeActiveCharge {
  available: boolean;
  completedSinceUse: number;
  required: number;
  remaining: number;
  lastUsedAt: string | null;
}

const COSTUMES: StepQuestCostumeDefinition[] = [
  {
    id: 'starter_mage',
    name: '\uCD08\uB3D9 \uB9C8\uBC95\uC0AC',
    role: '\uC2DC\uC791 \uC7A5\uBCBD \uC81C\uAC70',
    passiveAbility: '\uC138\uC158 \uCCAB Step XP +20%',
    activeAbility: '\uCCAB \uBD88\uC528: \uD604\uC7AC Step\uC744 10\uCD08 \uC774\uD558\uB85C \uBD84\uD574',
    unlockText: '\uAE30\uBCF8 \uC9C0\uAE09',
    metric: 'always',
    target: 1,
  },
  {
    id: 'focus_archer',
    name: '\uC9D1\uC911 \uC0AC\uC218',
    role: '\uC9E7\uC740 \uC9D1\uC911',
    passiveAbility: '\uACF5\uBD80 Step \uBCF4\uC0C1 +15%',
    activeAbility: '\uC870\uC900 \uACE0\uC815: \uBC29\uD574 \uC694\uC18C \uC810\uAC80 \uD6C4 3\uBD84 Step',
    unlockText: '\uACF5\uBD80 Step 5\uD68C \uC644\uB8CC',
    metric: 'category_completed',
    category: 'study',
    target: 5,
  },
  {
    id: 'return_paladin',
    name: '\uADC0\uD658 \uC131\uAE30\uC0AC',
    role: '\uBCF5\uADC0',
    passiveAbility: '24\uC2DC\uAC04 \uC774\uC0C1 \uBE44\uD65C\uC131 \uD6C4 \uCCAB Step \uBCF4\uC0C1 +30%',
    activeAbility: '\uADC0\uD658 \uC11C\uC57D: \uC77C\uC2DC\uC815\uC9C0 Goal\uC744 5~10\uCD08 \uBCF5\uAD6C Step\uC73C\uB85C \uC7AC\uAD6C\uC131',
    unlockText: '\uBCF5\uADC0 \uC138\uC158 3\uD68C',
    metric: 'return_sessions',
    target: 3,
  },
  {
    id: 'tidy_rogue',
    name: '\uC815\uB3C8 \uB3C4\uC801',
    role: '\uCCAD\uC18C\u00B7\uC815\uB9AC',
    passiveAbility: '\uC815\uB9AC Step \uBCF4\uC0C1 +20%',
    activeAbility: '\uD55C \uCE78 \uBE44\uC6B0\uAE30: \uB208\uC55E\uC758 \uBB3C\uAC74 \uD558\uB098\uB9CC \uCE58\uC6B0\uB294 Step \uC0DD\uC131',
    unlockText: '\uC815\uB9AC Step 10\uD68C \uC644\uB8CC',
    metric: 'category_completed',
    category: 'cleaning',
    target: 10,
  },
  {
    id: 'blank_scribe',
    name: '\uBC31\uC9C0 \uAE30\uB85D\uC790',
    role: '\uAE00\uC4F0\uAE30\u00B7\uCC3D\uC791',
    passiveAbility: '\uCCAB \uBB38\uC7A5\u00B7\uCD08\uC548 Step \uBCF4\uC0C1 +20%',
    activeAbility: '\uBC31\uC9C0 \uD30C\uAD34: 3\uBD84 \uC218\uC815 \uAE08\uC9C0 \uC9D1\uD544 Step \uC0DD\uC131',
    unlockText: '\uAE00\uC4F0\uAE30 Step 10\uD68C \uC644\uB8CC',
    metric: 'category_completed',
    category: 'writing',
    target: 10,
  },
  {
    id: 'dawn_knight',
    name: '\uC0C8\uBCBD \uAE30\uC0AC',
    role: '\uAE30\uC0C1\u00B7\uC544\uCE68 \uB8E8\uD2F4',
    passiveAbility: '\uAE30\uC0C1 Step \uBCF4\uC0C1 +20%',
    activeAbility: '\uCCAB \uBC1C: \uC774\uBD88 \uBC16\uC73C\uB85C \uD55C\uCABD \uB2E4\uB9AC\uB97C \uBE7C\uB294 Step \uC0DD\uC131',
    unlockText: '\uAE30\uC0C1 Step 5\uD68C \uC644\uB8CC',
    metric: 'category_completed',
    category: 'wake',
    target: 5,
  },
  {
    id: 'one_punch_hero',
    name: '\uC6D0\uD380\uCE58 \uD14C\uC2A4\uD2B8 \uD788\uC5B4\uB85C',
    role: '\uC288\uD37C QA',
    passiveAbility: '\uBAA8\uB4E0 Step \uBCF4\uC0C1 x3',
    activeAbility: '\uB300\uCDA9 \uD55C \uBC88: \uD604\uC7AC Step \uC55E\uC5D0 5\uCD08 \uD14C\uC2A4\uD2B8 Step \uC0DD\uC131',
    unlockText: '\uC288\uD37C \uACC4\uC815 \uC804\uC6A9',
    metric: 'total_completed',
    target: 1,
  },
];

@Injectable()
export class StepQuestService {
  private readonly decomposer = createStepQuestDecomposer();

  constructor(private readonly db: DatabaseService) {}

  async createGoal(userId: number, body: CreateStepQuestGoalDto) {
    const output = await this.decomposer.decompose({
      goalTitle: body.title,
      category: body.category as QuestCategory | 'auto' | undefined,
      burdenLevel: body.burdenLevel,
      energyLevel: body.energyLevel ?? 'medium',
      location: body.location,
      availableMinutes: body.availableMinutes,
      obstacle: body.obstacle as FailureReason | undefined,
    });

    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);

      const goal = await client.query<{
        id: number;
        title: string;
        category: QuestCategory;
        status: string;
        burdenLevel: number;
        createdAt: string;
      }>(
        `INSERT INTO stepquest_goals (user_id, title, normalized_title, category, burden_level, target_at, recurrence_rule)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING
           id,
           title,
           category,
           status,
           burden_level AS "burdenLevel",
           target_at AS "targetAt",
           recurrence_rule AS "recurrenceRule",
           created_at AS "createdAt"`,
        [
          userId,
          body.title,
          output.normalizedGoal,
          output.category,
          body.burdenLevel,
          body.targetAt ? new Date(body.targetAt).toISOString() : null,
          this.goalMetadataRule(body),
        ],
      );

      const chain = await client.query<{ id: number; revision: number; source: string; status: string }>(
        `INSERT INTO stepquest_chains (goal_id, revision, source, status)
         VALUES ($1, 1, $2, 'active')
         RETURNING id, revision, source, status`,
        [goal.rows[0].id, output.source],
      );

      const steps = [];
      for (const [index, step] of output.steps.entries()) {
        const reward = calculateStepReward({ grade: step.grade, sessionCombo: 0 });
        const inserted = await client.query(
          `INSERT INTO stepquest_micro_steps
             (chain_id, title, success_criterion, phase, order_index, estimated_seconds, grade, status, xp_reward, facility_reward, activated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $8 = 'active' THEN NOW() ELSE NULL END)
           RETURNING
             id,
             chain_id AS "chainId",
             title,
             success_criterion AS "successCriterion",
             phase,
             order_index AS "orderIndex",
             estimated_seconds AS "estimatedSeconds",
             grade,
             status,
             xp_reward AS "xpReward",
             facility_reward AS "facilityReward",
             activated_at AS "activatedAt"`,
          [
            chain.rows[0].id,
            step.title,
            step.successCriterion,
            step.phase,
            index,
            step.estimatedSeconds,
            step.grade,
            index === 0 ? 'active' : 'pending',
            reward.xp,
            reward.facilityXp,
          ],
        );
        steps.push(inserted.rows[0]);
      }

      return {
        goal: goal.rows[0],
        chain: {
          ...chain.rows[0],
          goalTitle: goal.rows[0].title,
          totalSteps: steps.length,
          completedSteps: 0,
        },
        steps,
        firstStep: steps[0],
        message: output.message,
      };
    });
  }

  async importGuestProgress(userId: number, body: ImportGuestProgressDto) {
    const migrationId = body.migrationId?.trim();
    if (!migrationId) {
      throw new BadRequestException('migrationId is required.');
    }

    const guest = this.normalizeGuestImport(body.guestState);
    if (!guest.goals.length && !guest.steps.length) {
      return {
        status: 'no_guest_data',
        migratedAt: null,
        message: '옮길 게스트 진행도가 없습니다.',
      };
    }

    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);

      const existingMigration = await client.query<{
        status: string;
        importedGoalCount: number;
        importedStepCount: number;
        migratedAt: string;
      }>(
        `SELECT
           status,
           imported_goal_count AS "importedGoalCount",
           imported_step_count AS "importedStepCount",
           migrated_at AS "migratedAt"
         FROM stepquest_guest_migrations
         WHERE user_id = $1 AND migration_id = $2`,
        [userId, migrationId],
      );
      if (existingMigration.rowCount) {
        return {
          status: existingMigration.rows[0].status,
          duplicate: true,
          migratedAt: existingMigration.rows[0].migratedAt,
          importedGoalCount: existingMigration.rows[0].importedGoalCount,
          importedStepCount: existingMigration.rows[0].importedStepCount,
          message: '이미 처리한 게스트 진행도입니다.',
        };
      }

      const hasAccountData = await this.hasAccountStepQuestData(client, userId);
      if (hasAccountData && !body.choice) {
        return {
          status: 'needs_choice',
          options: ['import_guest', 'keep_account', 'merge'],
          mergeSupported: false,
          message: '계정 진행도가 이미 있습니다. 알파에서는 자동 병합하지 않습니다.',
        };
      }

      if (body.choice === 'merge') {
        return {
          status: 'needs_choice',
          options: ['import_guest', 'keep_account'],
          mergeSupported: false,
          message: '알파에서는 자동 병합을 막고 있습니다. 게스트 진행도 가져오기 또는 계정 진행도 사용을 선택해 주세요.',
        };
      }

      if (hasAccountData && body.choice === 'keep_account') {
        const skipped = await client.query<{ migratedAt: string }>(
          `INSERT INTO stepquest_guest_migrations
             (user_id, migration_id, status, imported_goal_count, imported_step_count)
           VALUES ($1, $2, 'skipped', 0, 0)
           RETURNING migrated_at AS "migratedAt"`,
          [userId, migrationId],
        );
        return {
          status: 'skipped',
          migratedAt: skipped.rows[0].migratedAt,
          importedGoalCount: 0,
          importedStepCount: 0,
          message: '계정 진행도를 유지했습니다.',
        };
      }

      const imported = await this.importGuestSnapshot(client, userId, migrationId, guest);
      await this.updateConsistency(client, userId);
      return imported;
    });
  }

  async getCurrent(userId: number) {
    await this.ensureUserState(this.db, userId);
    const step = await this.findCurrentStep(this.db, userId);
    const deferredStep = step ? null : await this.findDeferredStep(this.db, userId);
    const user = await this.getUserState(userId);
    const village = await this.getVillage(userId);
    const consistency = await this.getConsistencyState(userId);
    const chainSnapshot = await this.getActiveChainSnapshot(userId, step?.chainId || deferredStep?.chainId);
    return {
      currentStep: step,
      deferredStep,
      chain: chainSnapshot.chain,
      steps: chainSnapshot.steps,
      user,
      village,
      consistency,
      message: step ? ONE_ACTION_MESSAGE : undefined,
    };
  }

  async getDungeons(userId: number) {
    await this.ensureUserState(this.db, userId);
    const goals = await this.db.query<{
      goalId: number;
      title: string;
      category: QuestCategory;
      goalStatus: string;
      burdenLevel: number;
      chainId: number | null;
      revision: number | null;
      chainStatus: string | null;
      totalSteps: number;
      completedSteps: number;
      replacedSteps: number;
      skippedSteps: number;
      lastCompletedTitle: string | null;
      lastCompletedAt: string | null;
      nextStepId: number | null;
      nextStepTitle: string | null;
      nextStepSeconds: number | null;
      updatedAt: string;
    }>(
      `SELECT
         g.id AS "goalId",
         g.title,
         g.category,
         g.status AS "goalStatus",
         g.burden_level AS "burdenLevel",
         c.id AS "chainId",
         c.revision,
         c.status AS "chainStatus",
         COUNT(ms.id)::int AS "totalSteps",
         COUNT(ms.id) FILTER (WHERE ms.status = 'completed')::int AS "completedSteps",
         COUNT(ms.id) FILTER (WHERE ms.status = 'replaced')::int AS "replacedSteps",
         COUNT(ms.id) FILTER (WHERE ms.status = 'skipped')::int AS "skippedSteps",
         last_ms.title AS "lastCompletedTitle",
         last_ms.completed_at AS "lastCompletedAt",
         next_ms.id AS "nextStepId",
         next_ms.title AS "nextStepTitle",
         next_ms.estimated_seconds AS "nextStepSeconds",
         g.updated_at AS "updatedAt"
       FROM stepquest_goals g
       LEFT JOIN LATERAL (
         SELECT c2.*
         FROM stepquest_chains c2
         WHERE c2.goal_id = g.id
         ORDER BY c2.revision DESC, c2.id DESC
         LIMIT 1
       ) c ON TRUE
       LEFT JOIN stepquest_micro_steps ms ON ms.chain_id = c.id
       LEFT JOIN LATERAL (
         SELECT ms2.title, ms2.completed_at
         FROM stepquest_micro_steps ms2
         WHERE ms2.chain_id = c.id AND ms2.status = 'completed'
         ORDER BY ms2.completed_at DESC, ms2.id DESC
         LIMIT 1
       ) last_ms ON TRUE
       LEFT JOIN LATERAL (
         SELECT ms3.id, ms3.title, ms3.estimated_seconds
         FROM stepquest_micro_steps ms3
         WHERE ms3.chain_id = c.id AND ms3.status IN ('active', 'deferred', 'pending')
         ORDER BY CASE ms3.status WHEN 'active' THEN 0 WHEN 'deferred' THEN 1 ELSE 2 END, ms3.order_index ASC, ms3.id ASC
         LIMIT 1
       ) next_ms ON TRUE
       WHERE g.user_id = $1 AND g.status IN ('active', 'paused')
       GROUP BY g.id, c.id, c.revision, c.status, last_ms.title, last_ms.completed_at, next_ms.id, next_ms.title, next_ms.estimated_seconds
       ORDER BY CASE WHEN g.status = 'active' THEN 0 ELSE 1 END, g.updated_at DESC, g.id DESC`,
      [userId],
    );

    return goals.rows.map((row) => ({
      ...row,
      name: `${row.title} \uC6D0\uC815`,
      status: row.goalStatus === 'completed' ? 'cleared' : row.goalStatus,
      progress: row.totalSteps ? Math.round((row.completedSteps / row.totalSteps) * 100) : 0,
      themeKey: DUNGEON_THEME_BY_CATEGORY[row.category],
      lastCompletedStep: row.lastCompletedTitle
        ? { title: row.lastCompletedTitle, completedAt: row.lastCompletedAt }
        : null,
      nextStep: row.nextStepId
        ? { id: row.nextStepId, title: row.nextStepTitle, estimatedSeconds: row.nextStepSeconds }
        : null,
    }));
  }

  async setGoalStatus(userId: number, goalId: number, status: 'active' | 'paused' | 'archived') {
    await this.ensureUserState(this.db, userId);
    if (status === 'active') {
      await this.db.query(
        `UPDATE stepquest_goals
         SET status = 'paused', updated_at = NOW()
         WHERE user_id = $1 AND status = 'active' AND id <> $2`,
        [userId, goalId],
      );
    }
    const result = await this.db.query(
      `UPDATE stepquest_goals
       SET status = $3, updated_at = NOW()
       WHERE user_id = $1
         AND id = $2
         AND status IN ('active', 'paused')
       RETURNING id, title, category, status, updated_at AS "updatedAt"`,
      [userId, goalId, status],
    );
    if (!result.rowCount) throw new NotFoundException('STEPQUEST \uBAA9\uD45C\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    await this.touchUser(this.db, userId);
    return {
      goal: result.rows[0],
      dungeons: await this.getDungeons(userId),
    };
  }

  async regenerateChain(userId: number, goalId: number, reason = 'too_big') {
    await this.ensureUserState(this.db, userId);
    return this.db.withTransaction(async (client) => {
      const goal = await client.query<{
        id: number;
        title: string;
        category: QuestCategory;
        burdenLevel: 1 | 2 | 3 | 4;
        recurrenceRule: string | null;
      }>(
        `SELECT
           id,
           title,
           category,
           burden_level AS "burdenLevel",
           recurrence_rule AS "recurrenceRule"
         FROM stepquest_goals
         WHERE user_id = $1
           AND id = $2
           AND status IN ('active', 'paused')
         FOR UPDATE`,
        [userId, goalId],
      );
      if (!goal.rowCount) throw new NotFoundException('STEPQUEST 목표를 찾지 못했습니다.');

      const metadata = this.parseGoalMetadata(goal.rows[0].recurrenceRule);
      const obstacle = this.normalizeRegenerateReason(reason);
      const output = await this.decomposer.decompose({
        goalTitle: goal.rows[0].title,
        category: goal.rows[0].category,
        burdenLevel: goal.rows[0].burdenLevel,
        energyLevel: metadata.energyLevel || 'medium',
        location: metadata.location,
        availableMinutes: metadata.availableMinutes,
        obstacle,
      });

      const latest = await client.query<{ revision: number }>(
        `SELECT COALESCE(MAX(revision), 0)::int AS revision
         FROM stepquest_chains
         WHERE goal_id = $1`,
        [goalId],
      );
      await client.query(
        `UPDATE stepquest_chains
         SET status = 'superseded'
         WHERE goal_id = $1 AND status = 'active'`,
        [goalId],
      );
      await client.query(
        `UPDATE stepquest_goals
         SET status = 'active', completed_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [goalId],
      );

      const chain = await client.query<{ id: number; revision: number; source: string; status: string }>(
        `INSERT INTO stepquest_chains (goal_id, revision, source, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id, revision, source, status`,
        [goalId, Number(latest.rows[0]?.revision || 0) + 1, output.source],
      );

      const steps = [];
      for (const [index, step] of output.steps.entries()) {
        const reward = calculateStepReward({ grade: step.grade, sessionCombo: 0 });
        const inserted = await client.query(
          `INSERT INTO stepquest_micro_steps
             (chain_id, title, success_criterion, phase, order_index, estimated_seconds, grade, status, xp_reward, facility_reward, activated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $8 = 'active' THEN NOW() ELSE NULL END)
           RETURNING
             id,
             chain_id AS "chainId",
             title,
             success_criterion AS "successCriterion",
             phase,
             order_index AS "orderIndex",
             estimated_seconds AS "estimatedSeconds",
             grade,
             status,
             xp_reward AS "xpReward",
             facility_reward AS "facilityReward",
             activated_at AS "activatedAt"`,
          [
            chain.rows[0].id,
            step.title,
            step.successCriterion,
            step.phase,
            index,
            step.estimatedSeconds,
            step.grade,
            index === 0 ? 'active' : 'pending',
            reward.xp,
            reward.facilityXp,
          ],
        );
        steps.push(inserted.rows[0]);
      }

      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action, reason)
         VALUES ($1, $2, 'shrink', $3)`,
        [steps[0].id, userId, `regenerate:${obstacle}`],
      );
      await this.touchUser(client, userId);

      return {
        goal: goal.rows[0],
        chain: {
          ...chain.rows[0],
          goalTitle: goal.rows[0].title,
          totalSteps: steps.length,
          completedSteps: 0,
        },
        steps,
        firstStep: steps[0],
        reason: obstacle,
        message: '원정을 다시 작은 입구로 쪼갰습니다.',
      };
    });
  }

  async getStats(userId: number) {
    await this.ensureUserState(this.db, userId);
    const attempts = await this.db.query<{
      action: string;
      count: number;
    }>(
      `SELECT action, COUNT(*)::int AS count
       FROM stepquest_step_attempts
       WHERE user_id = $1
       GROUP BY action`,
      [userId],
    );
    const steps = await this.db.query<{
      totalSteps: number;
      completedSteps: number;
      replacedSteps: number;
      skippedSteps: number;
    }>(
      `SELECT
         COUNT(ms.id)::int AS "totalSteps",
         COUNT(ms.id) FILTER (WHERE ms.status = 'completed')::int AS "completedSteps",
         COUNT(ms.id) FILTER (WHERE ms.status = 'replaced')::int AS "replacedSteps",
         COUNT(ms.id) FILTER (WHERE ms.status = 'skipped')::int AS "skippedSteps"
       FROM stepquest_micro_steps ms
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       WHERE g.user_id = $1`,
      [userId],
    );
    const rewards = await this.db.query<{
      rewardType: string;
      amount: number;
    }>(
      `SELECT reward_type AS "rewardType", COALESCE(SUM(amount), 0)::int AS amount
       FROM stepquest_reward_transactions
       WHERE user_id = $1
      GROUP BY reward_type`,
      [userId],
    );
    const recent = await this.db.query<{
      id: number;
      stepId: number;
      action: string;
      reason: string | null;
      createdAt: string;
      stepTitle: string;
      goalTitle: string;
    }>(
      `SELECT
         a.id,
         a.step_id AS "stepId",
         a.action,
         a.reason,
         a.created_at AS "createdAt",
         ms.title AS "stepTitle",
         g.title AS "goalTitle"
       FROM stepquest_step_attempts a
       JOIN stepquest_micro_steps ms ON ms.id = a.step_id
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 6`,
      [userId],
    );

    return {
      attempts: attempts.rows.reduce<Record<string, number>>((memo, row) => {
        memo[row.action] = row.count;
        return memo;
      }, {}),
      steps: steps.rows[0] ?? { totalSteps: 0, completedSteps: 0, replacedSteps: 0, skippedSteps: 0 },
      rewards: rewards.rows.reduce<Record<string, number>>((memo, row) => {
        memo[row.rewardType] = row.amount;
        return memo;
      }, {}),
      recent: recent.rows,
    };
  }

  async getReminder(userId: number) {
    await this.ensureUserState(this.db, userId);
    const reminder = await this.db.query<{
      userId: number;
      stepId: number | null;
      at: string;
      minutes: number;
      enabled: boolean;
      updatedAt: string;
    }>(
      `SELECT
         user_id AS "userId",
         step_id AS "stepId",
         remind_at AS "at",
         minutes,
         enabled,
         updated_at AS "updatedAt"
       FROM stepquest_reminders
       WHERE user_id = $1`,
      [userId],
    );
    return reminder.rows[0] ?? { userId, stepId: null, at: null, minutes: 10, enabled: false };
  }

  async saveReminder(userId: number, body: SaveReminderDto) {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const current = await this.findCurrentStep(client, userId);
      const stepId = body.stepId ?? current?.stepId ?? null;

      if (stepId) {
        const ownedStep = await client.query(
          `SELECT ms.id
           FROM stepquest_micro_steps ms
           JOIN stepquest_chains c ON c.id = ms.chain_id
           JOIN stepquest_goals g ON g.id = c.goal_id
           WHERE g.user_id = $1 AND ms.id = $2`,
          [userId, stepId],
        );
        if (!ownedStep.rowCount) {
          throw new NotFoundException('\uC54C\uB9BC\uC744 \uC800\uC7A5\uD560 STEPQUEST \uD589\uB3D9\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
        }
      }

      const minutes = Math.max(1, Math.min(1440, body.minutes));
      const reminder = await client.query<{
        userId: number;
        stepId: number | null;
        at: string;
        minutes: number;
        enabled: boolean;
        updatedAt: string;
      }>(
        `INSERT INTO stepquest_reminders (user_id, step_id, remind_at, minutes, enabled, updated_at)
         VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 minute'), $3, TRUE, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET
           step_id = EXCLUDED.step_id,
           remind_at = EXCLUDED.remind_at,
           minutes = EXCLUDED.minutes,
           enabled = TRUE,
           updated_at = NOW()
         RETURNING
           user_id AS "userId",
           step_id AS "stepId",
           remind_at AS "at",
           minutes,
           enabled,
           updated_at AS "updatedAt"`,
        [userId, stepId, minutes],
      );
      return reminder.rows[0];
    });
  }

  async handleReminderAction(userId: number, body: ReminderActionDto) {
    const reminder = await this.getReminder(userId);
    const stepId = reminder.stepId ?? (await this.findCurrentStep(this.db, userId))?.stepId ?? null;
    if (!stepId) {
      throw new BadRequestException('\uC54C\uB9BC\uC5D0 \uC5F0\uACB0\uD560 STEPQUEST \uD589\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
    }

    if (body.action === 'complete') {
      const result = await this.completeStep(userId, stepId, `reminder:${stepId}:complete`);
      await this.disableReminder(userId);
      return {
        action: body.action,
        ...result,
      };
    }

    if (body.action === 'snooze') {
      const saved = await this.saveReminder(userId, {
        stepId,
        minutes: body.minutes ?? 5,
      });
      return {
        action: body.action,
        reminder: saved,
        message: '\uC54C\uB9BC\uC744 \uB2E4\uC2DC \uC5F4\uC5C8\uC2B5\uB2C8\uB2E4.',
      };
    }

    if (body.action === 'shrink') {
      const result = await this.shrinkStep(userId, stepId, 'too_big');
      await this.disableReminder(userId);
      return {
        action: body.action,
        ...result,
      };
    }

    const result = await this.skipStep(userId, stepId);
    await this.disableReminder(userId);
    return {
      action: body.action,
      ...result,
    };
  }

  async getCostumes(userId: number) {
    await this.ensureUserState(this.db, userId);
    const [user, progress] = await Promise.all([
      this.getUserState(userId),
      this.getCostumeProgress(userId),
    ]);
    const costumes = [];
    for (const costume of this.availableCostumes()) {
      costumes.push(this.mapCostume(
        costume,
        user?.equippedCostumeId || 'starter_mage',
        progress,
        await this.getCostumeActiveCharge(this.db, userId, costume.id),
      ));
    }
    return costumes;
  }

  async equipCostume(userId: number, costumeId: string) {
    await this.ensureUserState(this.db, userId);
    const costume = this.availableCostumes().find((item) => item.id === costumeId);
    if (!costume) throw new NotFoundException('STEPQUEST \uCF54\uC2A4\uD2AC\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');

    const progress = await this.getCostumeProgress(userId);
    const mapped = this.mapCostume(costume, costumeId, progress);
    if (!mapped.unlocked) {
      throw new BadRequestException('\uC544\uC9C1 \uD574\uAE08\uB418\uC9C0 \uC54A\uC740 \uCF54\uC2A4\uD2AC\uC785\uB2C8\uB2E4.');
    }

    const updated = await this.db.query(
      `UPDATE stepquest_user_states
       SET equipped_costume_id = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING
         user_id AS "userId",
         level,
         xp,
         material,
         return_marks AS "returnMarks",
         equipped_costume_id AS "equippedCostumeId",
         last_active_at AS "lastActiveAt"`,
      [userId, costumeId],
    );
    return {
      user: updated.rows[0],
      equippedCostume: this.mapCostume(costume, costumeId, progress),
      costumes: this.availableCostumes().map((item) => this.mapCostume(item, costumeId, progress)),
    };
  }

  async activateCostume(userId: number, costumeId: string) {
    await this.ensureUserState(this.db, userId);
    const costume = this.availableCostumes().find((item) => item.id === costumeId);
    if (!costume) throw new NotFoundException('STEPQUEST \uCF54\uC2A4\uD2AC\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');

    const progress = await this.getCostumeProgress(userId);
    const mapped = this.mapCostume(costume, costumeId, progress);
    if (!mapped.unlocked) {
      throw new BadRequestException('\uC544\uC9C1 \uD574\uAE08\uB418\uC9C0 \uC54A\uC740 \uCF54\uC2A4\uD2AC\uC785\uB2C8\uB2E4.');
    }

    if (costumeId === 'starter_mage') {
      const current = await this.findCurrentStep(this.db, userId);
      if (!current) throw new BadRequestException('\uB354 \uC791\uAC8C \uB098\uB20C STEPQUEST \uD589\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
      await this.assertCostumeActiveAvailable(this.db, userId, costumeId);
      const result = await this.shrinkStep(userId, current.stepId, 'costume_active');
      await this.recordCostumeActiveUse(this.db, userId, current.stepId, costumeId);
      return {
        ...result,
        costumeId,
        activeCharge: this.depletedCostumeActiveCharge(),
      };
    }

    if (costumeId === 'return_paladin') {
      await this.assertCostumeActiveAvailable(this.db, userId, costumeId);
      return this.activateReturnPaladin(userId);
    }

    const templates = this.costumeAbilitySteps(costumeId);
    if (!templates.length) {
      return {
        costumeId,
        message: '\uC774 \uCF54\uC2A4\uD2AC\uC740 \uD328\uC2DC\uBE0C \uBCF4\uC0C1 \uC804\uB7B5\uC744 \uBC14\uAFC9\uB2C8\uB2E4.',
      };
    }

    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const current = await this.findCurrentStep(client, userId);
      if (!current) throw new BadRequestException('\uCF54\uC2A4\uD2AC \uB2A5\uB825\uC744 \uC801\uC6A9\uD560 STEPQUEST \uD589\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
      await this.assertCostumeActiveAvailable(client, userId, costumeId);

      await client.query(
        `UPDATE stepquest_micro_steps
         SET status = 'pending', activated_at = NULL
         WHERE id = $1`,
        [current.stepId],
      );
      await client.query(
        `UPDATE stepquest_micro_steps
         SET order_index = order_index + $2
         WHERE chain_id = $1
           AND order_index >= $3`,
        [current.chainId, templates.length, current.orderIndex],
      );

      const created = [];
      for (const [index, template] of templates.entries()) {
        const grade = gradeForSeconds(template.seconds);
        const reward = calculateStepReward({ grade, sessionCombo: 0 });
        const inserted = await client.query(
          `INSERT INTO stepquest_micro_steps
             (chain_id, title, success_criterion, phase, order_index, estimated_seconds, grade, status, xp_reward, facility_reward, activated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $8 = 'active' THEN NOW() ELSE NULL END)
           RETURNING
             id,
             chain_id AS "chainId",
             title,
             success_criterion AS "successCriterion",
             phase,
             order_index AS "orderIndex",
             estimated_seconds AS "estimatedSeconds",
             grade,
             status,
             xp_reward AS "xpReward",
             facility_reward AS "facilityReward",
             activated_at AS "activatedAt"` ,
          [
            current.chainId,
            template.title,
            `${template.title} 완료`,
            template.phase,
            current.orderIndex + index,
            template.seconds,
            grade,
            index === 0 ? 'active' : 'pending',
            reward.xp,
            reward.facilityXp,
          ],
        );
        created.push(inserted.rows[0]);
      }

      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action, reason)
         VALUES ($1, $2, 'costume_active', $3)`,
        [current.stepId, userId, costumeId],
      );
      await client.query(`UPDATE stepquest_chains SET source = 'costume', revision = revision + 1 WHERE id = $1`, [current.chainId]);
      await this.touchUser(client, userId);

      return {
        costumeId,
        firstStep: created[0],
        createdSteps: created,
        insertedSteps: created,
        originalStep: current,
        activeCharge: this.depletedCostumeActiveCharge(),
        message: '\uCF54\uC2A4\uD2AC \uB2A5\uB825\uC73C\uB85C \uC791\uC740 \uC785\uAD6C\uB97C \uC5F4\uC5C8\uC2B5\uB2C8\uB2E4.',
      };
    });
  }

  async completeStep(userId: number, stepId: number, idempotencyKey?: string) {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const key = idempotencyKey ?? `step:${stepId}:complete`;

      const existing = await client.query(
        `SELECT id FROM stepquest_reward_transactions
         WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, key],
      );
      if (existing.rowCount) {
        return {
          stepId,
          duplicate: true,
          currentStep: await this.findCurrentStep(client, userId),
          message: PROGRESS_KEPT_MESSAGE,
        };
      }

      const step = await this.lockStep(client, userId, stepId);
      const returnSession = await client.query<{ id: number }>(
        `SELECT id
         FROM stepquest_return_sessions
         WHERE user_id = $1
           AND recovery_step_id = $2
           AND completed_at IS NULL
         FOR UPDATE`,
        [userId, stepId],
      );
      const isReturnStep = Boolean(returnSession.rowCount);
      await client.query(
        `UPDATE stepquest_micro_steps
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [stepId],
      );
      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action)
         VALUES ($1, $2, 'complete')`,
        [stepId, userId],
      );

      const combo = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM stepquest_micro_steps
         WHERE chain_id = $1 AND status = 'completed'`,
        [step.chainId],
      );
      const sessionCombo = Number(combo.rows[0]?.count || 1);
      const userState = await this.getUserState(userId, client);
      const costumeMultiplier = this.costumeRewardMultiplier(
        userState?.equippedCostumeId || 'starter_mage',
        step.category,
        sessionCombo,
        isReturnStep,
      );
      const reward = calculateStepReward({
        grade: gradeForSeconds(step.estimatedSeconds),
        sessionCombo,
        costumeMultiplier,
        isFirstReturnStep: isReturnStep,
      });
      await this.grantReward(client, userId, 'step', stepId, 'xp', reward.xp, key);
      await this.grantReward(client, userId, 'step', stepId, 'facility_xp', reward.facilityXp, `${key}:facility`);
      const comboBonus = sessionCombo > 0 && sessionCombo % 8 === 0 ? 5 : 0;
      if (comboBonus) {
        await this.grantReward(client, userId, 'achievement', stepId, 'facility_xp', comboBonus, `${key}:combo_chest`);
      }
      await this.growVillage(client, userId, step.category, reward.facilityXp);
      if (isReturnStep) {
        await client.query(
          `UPDATE stepquest_return_sessions
           SET completed_at = NOW()
           WHERE id = $1`,
          [returnSession.rows[0].id],
        );
      }

      const next = await this.activateNextPendingStep(client, userId, step.chainId);
      let clearedGoal = null;
      if (!next) {
        await client.query(`UPDATE stepquest_chains SET status = 'completed' WHERE id = $1`, [step.chainId]);
        const cleared = await client.query(
          `UPDATE stepquest_goals
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1
           RETURNING id, title, category, status, completed_at AS "completedAt"`,
          [step.goalId],
        );
        clearedGoal = cleared.rows[0] ?? null;
      }
      await this.touchUser(client, userId);
      const consistency = await this.updateConsistency(client, userId);

      return {
        stepId,
        reward,
        comboBonus,
        sessionCombo,
        costumeMultiplier,
        currentStep: next,
        clearedGoal,
        returnCompleted: isReturnStep,
        returnSessionId: returnSession.rows[0]?.id ?? null,
        consistency,
        message: PROGRESS_KEPT_MESSAGE,
      };
    });
  }

  async undoStepCompletion(userId: number, stepId: number) {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const step = await this.lockStepForStatuses(client, userId, stepId, ['completed', 'active']);
      if (step.status !== 'completed') {
        const alreadyUndone = await client.query(
          `SELECT id
           FROM stepquest_step_attempts
           WHERE step_id = $1
             AND user_id = $2
             AND action = 'undo'
           LIMIT 1`,
          [stepId, userId],
        );
        if (alreadyUndone.rowCount) {
          return {
            stepId,
            duplicate: true,
            reversedReward: { xp: 0, facilityXp: 0, comboBonus: 0 },
            currentStep: await this.findCurrentStep(client, userId),
            consistency: await this.getConsistencyState(userId, client),
            message: PROGRESS_KEPT_MESSAGE,
          };
        }
        throw new BadRequestException('\uC644\uB8CC\uB41C STEPQUEST \uD589\uB3D9\uB9CC \uB418\uB3CC\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
      }

      const laterProgress = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM stepquest_micro_steps
         WHERE chain_id = $1
           AND order_index > $2
           AND status IN ('completed', 'skipped', 'replaced')`,
        [step.chainId, step.orderIndex],
      );
      if (Number(laterProgress.rows[0]?.count || 0) > 0) {
        throw new BadRequestException('\uC774\uBBF8 \uB2E4\uC74C \uD589\uB3D9\uC744 \uC9C4\uD589\uD574\uC11C \uBC29\uAE08 \uC644\uB8CC\uB9CC \uB418\uB3CC\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
      }

      const rewardTotals = await client.query<{ rewardType: 'xp' | 'facility_xp'; amount: string }>(
        `SELECT reward_type AS "rewardType", COALESCE(SUM(amount), 0)::text AS amount
         FROM stepquest_reward_transactions
         WHERE user_id = $1
           AND source_type = 'step'
           AND source_id = $2
           AND reward_type IN ('xp', 'facility_xp')
         GROUP BY reward_type`,
        [userId, stepId],
      );
      const xp = Number(rewardTotals.rows.find((row) => row.rewardType === 'xp')?.amount || 0);
      const facilityXp = Number(rewardTotals.rows.find((row) => row.rewardType === 'facility_xp')?.amount || 0);
      const comboBonus = await client.query<{ amount: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS amount
         FROM stepquest_reward_transactions
         WHERE user_id = $1
           AND source_type = 'achievement'
           AND source_id = $2
           AND reward_type = 'facility_xp'`,
        [userId, stepId],
      );
      const bonusMaterial = Number(comboBonus.rows[0]?.amount || 0);
      const totalMaterial = facilityXp + bonusMaterial;

      await client.query(
        `UPDATE stepquest_micro_steps
         SET status = 'pending', activated_at = NULL
         WHERE chain_id = $1
           AND order_index > $2
           AND status = 'active'`,
        [step.chainId, step.orderIndex],
      );
      await client.query(
        `UPDATE stepquest_micro_steps
         SET status = 'active', completed_at = NULL, activated_at = NOW()
         WHERE id = $1`,
        [stepId],
      );
      await client.query(`UPDATE stepquest_chains SET status = 'active' WHERE id = $1`, [step.chainId]);
      await client.query(
        `UPDATE stepquest_goals
         SET status = 'active', completed_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [step.goalId],
      );
      await client.query(
        `DELETE FROM stepquest_reward_transactions
         WHERE user_id = $1
           AND source_type IN ('step', 'achievement')
           AND source_id = $2`,
        [userId, stepId],
      );
      if (xp || totalMaterial) {
        await client.query(
          `UPDATE stepquest_user_states
           SET
             xp = GREATEST(0, xp - $2),
             material = GREATEST(0, material - $3),
             level = FLOOR(GREATEST(0, xp - $2) / 10) + 1,
             updated_at = NOW()
           WHERE user_id = $1`,
          [userId, xp, totalMaterial],
        );
      }
      if (totalMaterial) {
        await client.query(
          `UPDATE currencies
           SET goal_coin = GREATEST(0, goal_coin - $2), updated_at = NOW()
           WHERE user_id = $1`,
          [userId, totalMaterial],
        );
      }
      if (facilityXp) {
        await this.shrinkVillage(client, userId, step.category, facilityXp);
      }
      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action)
         VALUES ($1, $2, 'undo')`,
        [stepId, userId],
      );
      await this.touchUser(client, userId);
      const consistency = await this.updateConsistency(client, userId);

      return {
        undoneStepId: stepId,
        currentStep: await this.findCurrentStep(client, userId),
        reversedReward: { xp, facilityXp: totalMaterial, comboBonus: bonusMaterial },
        consistency,
        message: '\uBC29\uAE08 \uC644\uB8CC\uB97C \uB418\uB3CC\uB838\uC2B5\uB2C8\uB2E4.',
      };
    });
  }

  async shrinkStep(userId: number, stepId: number, reason = 'too_big') {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const step = await this.lockStepForStatuses(client, userId, stepId, ['active', 'deferred']);
      const replacements = shrinkStep(step.title, step.estimatedSeconds);

      await client.query(`UPDATE stepquest_micro_steps SET status = 'replaced' WHERE id = $1`, [stepId]);
      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action, reason)
         VALUES ($1, $2, 'shrink', $3)`,
        [stepId, userId, reason],
      );
      await client.query(
        `UPDATE stepquest_micro_steps
         SET order_index = order_index + $3
         WHERE chain_id = $1 AND order_index > $2`,
        [step.chainId, step.orderIndex, replacements.length],
      );

      const created = [];
      for (const [index, replacement] of replacements.entries()) {
        const reward = calculateStepReward({ grade: replacement.grade, sessionCombo: 0 });
        const inserted = await client.query(
          `INSERT INTO stepquest_micro_steps
             (chain_id, title, success_criterion, phase, order_index, estimated_seconds, grade, status, xp_reward, facility_reward, activated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $8 = 'active' THEN NOW() ELSE NULL END)
           RETURNING
             id,
             chain_id AS "chainId",
             title,
             success_criterion AS "successCriterion",
             phase,
             order_index AS "orderIndex",
             estimated_seconds AS "estimatedSeconds",
             grade,
             status,
             xp_reward AS "xpReward",
             facility_reward AS "facilityReward",
             activated_at AS "activatedAt"`,
          [
            step.chainId,
            replacement.title,
            replacement.successCriterion,
            replacement.phase,
            step.orderIndex + index + 1,
            replacement.estimatedSeconds,
            replacement.grade,
            index === 0 ? 'active' : 'pending',
            reward.xp,
            reward.facilityXp,
          ],
        );
        created.push(inserted.rows[0]);
      }

      await client.query(
        `UPDATE stepquest_chains
         SET revision = revision + 1
         WHERE id = $1`,
        [step.chainId],
      );
      await this.touchUser(client, userId);

      return {
        replacedStepId: stepId,
        replacementSteps: created,
        firstStep: created[0],
        message: SHRINK_MESSAGE,
      };
    });
  }

  async skipStep(userId: number, stepId: number) {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const step = await this.lockStep(client, userId, stepId);
      await client.query(`UPDATE stepquest_micro_steps SET status = 'skipped' WHERE id = $1`, [stepId]);
      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action)
         VALUES ($1, $2, 'skip')`,
        [stepId, userId],
      );
      const next = await this.activateNextPendingStep(client, userId, step.chainId);
      await this.touchUser(client, userId);
      return {
        skippedStepId: stepId,
        currentStep: next,
        message: STOP_MESSAGE,
      };
    });
  }

  async deferStep(userId: number, stepId: number, reason = 'not_now') {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const step = await this.lockStep(client, userId, stepId);
      await client.query(
        `UPDATE stepquest_micro_steps
         SET status = 'deferred', activated_at = NULL
         WHERE id = $1`,
        [stepId],
      );
      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action, reason)
         VALUES ($1, $2, 'defer', $3)`,
        [stepId, userId, reason],
      );
      await this.touchUser(client, userId);
      return {
        deferredStepId: stepId,
        deferredStep: {
          ...step,
          status: 'deferred',
          activatedAt: null,
        },
        currentStep: await this.findCurrentStep(client, userId),
        message: STOP_MESSAGE,
      };
    });
  }

  async resumeDeferredStep(userId: number, stepId: number) {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const step = await this.lockStepForStatuses(client, userId, stepId, ['deferred']);
      await client.query(
        `UPDATE stepquest_micro_steps
         SET status = 'pending', activated_at = NULL
         WHERE chain_id = $1
           AND status = 'active'
           AND id <> $2`,
        [step.chainId, stepId],
      );
      await client.query(
        `UPDATE stepquest_micro_steps
         SET status = 'active', activated_at = NOW()
         WHERE id = $1`,
        [stepId],
      );
      await this.touchUser(client, userId);
      return {
        resumedStepId: stepId,
        currentStep: await this.findCurrentStep(client, userId),
        message: ONE_ACTION_MESSAGE,
      };
    });
  }

  async getReturnEligibility(userId: number) {
    await this.ensureUserState(this.db, userId);
    const user = await this.getUserState(userId);
    const inactiveHours = Math.max(0, (Date.now() - Date.parse(user.lastActiveAt)) / 36e5);
    return {
      eligible: inactiveHours >= 24,
      inactiveHours,
      message: inactiveHours >= 24 ? RETURN_MESSAGE : ONE_ACTION_MESSAGE,
    };
  }

  async startReturnSession(userId: number) {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const eligibility = await this.getReturnEligibility(userId);
      if (!eligibility.eligible) return eligibility;

      const current = await this.findReentryStep(client, userId);
      if (!current) return eligibility;

      await client.query(`UPDATE stepquest_micro_steps SET status = 'deferred' WHERE id = $1`, [current.stepId]);
      await client.query(
        `UPDATE stepquest_micro_steps
         SET order_index = order_index + 1
         WHERE chain_id = $1`,
        [current.chainId],
      );
      const inserted = await client.query(
        `INSERT INTO stepquest_micro_steps
           (chain_id, title, success_criterion, phase, order_index, estimated_seconds, grade, status, xp_reward, facility_reward, activated_at)
         VALUES ($1, $2, $3, 'orient', 0, 5, 'F', 'active', 1, 1, NOW())
         RETURNING
           id,
           chain_id AS "chainId",
           title,
           success_criterion AS "successCriterion",
           phase,
           order_index AS "orderIndex",
           estimated_seconds AS "estimatedSeconds",
           grade,
           status,
           xp_reward AS "xpReward",
           facility_reward AS "facilityReward",
           activated_at AS "activatedAt"`,
        [current.chainId, RETURN_STEP_TITLE, RETURN_STEP_SUCCESS],
      );

      await client.query(
        `INSERT INTO stepquest_return_sessions (user_id, goal_id, recovery_step_id)
         VALUES ($1, $2, $3)`,
        [userId, current.goalId, inserted.rows[0].id],
      );
      await this.grantReward(client, userId, 'return', inserted.rows[0].id, 'return_mark', 1, `return:${inserted.rows[0].id}`);
      await this.touchUser(client, userId);

      return {
        eligible: true,
        recoveryStep: inserted.rows[0],
        message: RETURN_MESSAGE,
      };
    });
  }

  private costumeAbilitySteps(costumeId: string): CostumeAbilityStepTemplate[] {
    if (costumeId === 'one_punch_hero' && !isSuperModeAllowed()) return [];
    const sets: Record<string, CostumeAbilityStepTemplate[]> = {
      focus_archer: [
        { title: '\uBC29\uD574 \uC694\uC18C \uD558\uB098 \uBCF4\uAE30', seconds: 10, phase: 'orient' },
        { title: '\uD654\uBA74 \uD558\uB098\uB9CC \uB0A8\uAE30\uAE30', seconds: 10, phase: 'prepare' },
        { title: '3\uBD84 \uD0C0\uC774\uBA38 \uC2DC\uC791\uD558\uAE30', seconds: 180, phase: 'continue' },
      ],
      tidy_rogue: [
        { title: '\uB208\uC55E\uC758 \uBB3C\uAC74 \uD558\uB098 \uBCF4\uAE30', seconds: 5, phase: 'orient' },
        { title: '\uADF8 \uBB3C\uAC74\uC744 \uC190\uC5D0 \uB4E4\uAE30', seconds: 10, phase: 'prepare' },
        { title: '\uB458 \uACF3\uC744 \uBC14\uB77C\uBCF4\uAE30', seconds: 10, phase: 'start' },
      ],
      blank_scribe: [
        { title: '\uC791\uC131\uD560 \uBB38\uC11C \uC5F4\uAE30', seconds: 10, phase: 'open' },
        { title: '\uCEE4\uC11C\uB97C \uBCF8\uBB38\uC5D0 \uB193\uAE30', seconds: 10, phase: 'prepare' },
        { title: '3\uBD84 \uB3D9\uC548 \uC218\uC815\uD558\uC9C0 \uC54A\uACE0 \uC4F0\uAE30', seconds: 180, phase: 'continue' },
      ],
      dawn_knight: [
        { title: '\uD55C\uCABD \uB2E4\uB9AC\uB97C \uC774\uBD88 \uBC16\uC73C\uB85C \uBE7C\uAE30', seconds: 8, phase: 'orient' },
        { title: '\uBC1C\uBC14\uB2E5\uC744 \uBC14\uB2E5\uC5D0 \uBD99\uC774\uAE30', seconds: 10, phase: 'start' },
      ],
      one_punch_hero: [
        { title: '\uC8FC\uBA39 \uD55C \uBC88 \uC950\uAE30', seconds: 5, phase: 'start' },
      ],
    };
    return sets[costumeId] || [];
  }

  private async activateReturnPaladin(userId: number) {
    return this.db.withTransaction(async (client) => {
      await this.ensureUserState(client, userId);
      const paused = await client.query<{
        goalId: number;
        chainId: number;
        stepId: number;
        goalTitle: string;
      }>(
        `SELECT
           g.id AS "goalId",
           c.id AS "chainId",
           ms.id AS "stepId",
           g.title AS "goalTitle"
         FROM stepquest_goals g
         JOIN stepquest_chains c ON c.goal_id = g.id AND c.status = 'active'
         JOIN stepquest_micro_steps ms ON ms.chain_id = c.id
         WHERE g.user_id = $1
           AND g.status = 'paused'
           AND ms.status IN ('active', 'pending', 'deferred')
         ORDER BY g.updated_at DESC, ms.order_index ASC, ms.id ASC
         LIMIT 1`,
        [userId],
      );
      if (!paused.rowCount) {
        throw new BadRequestException('\uBCF5\uAD6C\uD560 \uC77C\uC2DC\uC815\uC9C0 \uC6D0\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
      }
      const target = paused.rows[0];

      await client.query(
        `UPDATE stepquest_goals
         SET status = CASE WHEN id = $2 THEN 'active' WHEN status = 'active' THEN 'paused' ELSE status END,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId, target.goalId],
      );
      await client.query(
        `UPDATE stepquest_micro_steps
         SET status = CASE WHEN id = $2 THEN 'pending' ELSE status END,
             activated_at = CASE WHEN id = $2 THEN NULL ELSE activated_at END,
             order_index = order_index + 1
         WHERE chain_id = $1`,
        [target.chainId, target.stepId],
      );

      const inserted = await client.query(
        `INSERT INTO stepquest_micro_steps
           (chain_id, title, success_criterion, phase, order_index, estimated_seconds, grade, status, xp_reward, facility_reward, activated_at)
         VALUES ($1, $2, $3, 'orient', 0, 5, 'F', 'active', 1, 1, NOW())
         RETURNING
           id,
           chain_id AS "chainId",
           title,
           success_criterion AS "successCriterion",
           phase,
           order_index AS "orderIndex",
           estimated_seconds AS "estimatedSeconds",
           grade,
           status,
           xp_reward AS "xpReward",
           facility_reward AS "facilityReward",
           activated_at AS "activatedAt"` ,
        [
          target.chainId,
          '\uC77C\uC2DC\uC815\uC9C0\uD55C \uC6D0\uC815 \uC81C\uBAA9 \uD55C \uBC88 \uBCF4\uAE30',
          '\uC6D0\uC815 \uC81C\uBAA9 \uD655\uC778 \uC644\uB8CC',
        ],
      );
      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action, reason)
         VALUES ($1, $2, 'costume_active', 'return_paladin')`,
        [target.stepId, userId],
      );
      await client.query(`UPDATE stepquest_chains SET source = 'costume', revision = revision + 1 WHERE id = $1`, [target.chainId]);
      await this.touchUser(client, userId);

      return {
        costumeId: 'return_paladin',
        restoredGoalId: target.goalId,
        firstStep: inserted.rows[0],
        activeCharge: this.depletedCostumeActiveCharge(),
        message: RETURN_MESSAGE,
      };
    });
  }

  private async hasAccountStepQuestData(client: PoolClient, userId: number): Promise<boolean> {
    const result = await client.query<{ hasData: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM stepquest_goals WHERE user_id = $1 LIMIT 1
       ) AS "hasData"`,
      [userId],
    );
    return Boolean(result.rows[0]?.hasData);
  }

  private async importGuestSnapshot(
    client: PoolClient,
    userId: number,
    migrationId: string,
    guest: NormalizedGuestImport,
  ) {
    const goalIdMap = new Map<string, number>();
    const chainIdMap = new Map<string, number>();
    const stepIdMap = new Map<string, number>();
    let importedGoalCount = 0;
    let importedStepCount = 0;
    let completedRewardIndex = 0;

    for (const goal of guest.goals) {
      const insertedGoal = await client.query<{ id: number }>(
        `INSERT INTO stepquest_goals
           (user_id, title, normalized_title, category, burden_level, status, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), $8::timestamptz)
         RETURNING id`,
        [
          userId,
          goal.title,
          goal.title.trim().toLowerCase(),
          goal.category,
          goal.burdenLevel,
          goal.status,
          goal.createdAt,
          goal.completedAt,
        ],
      );
      const goalId = insertedGoal.rows[0].id;
      goalIdMap.set(goal.sourceId, goalId);
      importedGoalCount += 1;

      const insertedChain = await client.query<{ id: number }>(
        `INSERT INTO stepquest_chains (goal_id, revision, source, status)
         VALUES ($1, 1, 'manual', $2)
         RETURNING id`,
        [goalId, goal.status === 'completed' ? 'completed' : 'active'],
      );
      chainIdMap.set(goal.sourceId, insertedChain.rows[0].id);
    }

    for (const step of guest.steps) {
      const chainId = chainIdMap.get(step.sourceGoalId);
      if (!chainId) continue;
      const reward = calculateStepReward({ grade: step.grade, sessionCombo: 0 });
      const insertedStep = await client.query<{ id: number }>(
        `INSERT INTO stepquest_micro_steps
           (chain_id, title, success_criterion, phase, order_index, estimated_seconds, grade, status, xp_reward, facility_reward, activated_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
         RETURNING id`,
        [
          chainId,
          step.title,
          step.successCriterion,
          step.phase,
          step.orderIndex,
          step.estimatedSeconds,
          step.grade,
          step.status,
          reward.xp,
          reward.facilityXp,
          step.activatedAt,
          step.completedAt,
        ],
      );
      const stepId = insertedStep.rows[0].id;
      stepIdMap.set(step.sourceId, stepId);
      importedStepCount += 1;

      if (step.status === 'completed') {
        completedRewardIndex += 1;
        const key = `guest:${migrationId}:step:${step.sourceId}:complete`;
        const rewardWithCombo = calculateStepReward({ grade: step.grade, sessionCombo: completedRewardIndex });
        await this.grantReward(client, userId, 'step', stepId, 'xp', rewardWithCombo.xp, key);
        await this.grantReward(client, userId, 'step', stepId, 'facility_xp', rewardWithCombo.facilityXp, `${key}:facility`);
        await this.growVillage(client, userId, step.category || 'study', rewardWithCombo.facilityXp);
      }
    }

    for (const [sourceGoalId, chainId] of chainIdMap.entries()) {
      const hasOpen = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM stepquest_micro_steps
         WHERE chain_id = $1 AND status IN ('active', 'deferred')`,
        [chainId],
      );
      if (Number(hasOpen.rows[0]?.count || 0) === 0) {
        await client.query(
          `UPDATE stepquest_micro_steps
           SET status = 'active', activated_at = NOW()
           WHERE id = (
             SELECT id
             FROM stepquest_micro_steps
             WHERE chain_id = $1 AND status = 'pending'
             ORDER BY order_index ASC, id ASC
             LIMIT 1
           )`,
          [chainId],
        );
      }

      const anyActive = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM stepquest_micro_steps
         WHERE chain_id = $1 AND status IN ('active', 'deferred', 'pending')`,
        [chainId],
      );
      if (Number(anyActive.rows[0]?.count || 0) > 0) {
        const goalId = goalIdMap.get(sourceGoalId);
        if (goalId) {
          await client.query(
            `UPDATE stepquest_goals
             SET status = 'active', completed_at = NULL, updated_at = NOW()
             WHERE id = $1 AND status = 'completed'`,
            [goalId],
          );
          await client.query(`UPDATE stepquest_chains SET status = 'active' WHERE id = $1 AND status = 'completed'`, [chainId]);
        }
      }
    }

    for (const attempt of guest.attempts) {
      const stepId = stepIdMap.get(attempt.sourceStepId);
      if (!stepId) continue;
      await client.query(
        `INSERT INTO stepquest_step_attempts (step_id, user_id, action, reason)
         VALUES ($1, $2, $3, $4)`,
        [stepId, userId, attempt.action, attempt.reason],
      );
    }

    await client.query(
      `UPDATE stepquest_user_states
       SET
         return_marks = GREATEST(return_marks, $2),
         equipped_costume_id = $3,
         updated_at = NOW()
       WHERE user_id = $1`,
      [userId, guest.returnMarks, guest.equippedCostumeId],
    );

    const migration = await client.query<{ migratedAt: string }>(
      `INSERT INTO stepquest_guest_migrations
         (user_id, migration_id, status, imported_goal_count, imported_step_count)
       VALUES ($1, $2, 'imported', $3, $4)
       RETURNING migrated_at AS "migratedAt"`,
      [userId, migrationId, importedGoalCount, importedStepCount],
    );

    await this.touchUser(client, userId);
    return {
      status: 'imported',
      migratedAt: migration.rows[0].migratedAt,
      importedGoalCount,
      importedStepCount,
      message: '게스트 진행도를 계정으로 옮겼습니다.',
    };
  }

  private normalizeGuestImport(raw: Record<string, unknown>): NormalizedGuestImport {
    const guest = this.asRecord(raw);
    const goals = this.asArray(guest.weekly).map((item, index) => this.normalizeGuestGoal(item, index));
    if (!goals.length) {
      goals.push({
        sourceId: 'guest-goal',
        title: '게스트 목표',
        category: 'study',
        burdenLevel: 2,
        status: 'active',
      });
    }

    const goalIds = new Set(goals.map((goal) => goal.sourceId));
    const fallbackGoalId = goals[0].sourceId;
    const goalById = new Map(goals.map((goal) => [goal.sourceId, goal]));
    const steps = this.asArray(guest.micro)
      .map((item, index) => this.normalizeGuestStep(item, index, goalIds, fallbackGoalId, goalById))
      .filter((step): step is GuestImportStep => Boolean(step));
    const attempts = this.asArray(guest.attempts)
      .map((item) => this.normalizeGuestAttempt(item))
      .filter((attempt): attempt is GuestImportAttempt => Boolean(attempt));
    const player = this.asRecord(guest.player);
    const requestedCostumeId = this.readString(guest.equippedCostumeId)
      || this.readString(player.equippedCostumeId)
      || 'starter_mage';

    return {
      goals,
      steps,
      attempts,
      equippedCostumeId: this.safeCostumeId(requestedCostumeId),
      returnMarks: Math.max(0, this.readNumber(player.returnMarks, 0)),
    };
  }

  private normalizeGuestGoal(raw: unknown, index: number): GuestImportGoal {
    const item = this.asRecord(raw);
    const status = this.readString(item.status);
    return {
      sourceId: this.readString(item.id) || `guest-goal-${index + 1}`,
      title: this.readString(item.title)?.slice(0, 140) || '게스트 목표',
      category: this.normalizeCategory(this.readString(item.category)),
      burdenLevel: this.normalizeBurdenLevel(this.readNumber(item.burdenLevel, 2)),
      status: status === 'DONE' || status === 'completed'
        ? 'completed'
        : status === 'ARCHIVED' || status === 'archived'
          ? 'archived'
          : status === 'PAUSED' || status === 'paused'
            ? 'paused'
            : 'active',
      createdAt: this.normalizeIsoString(item.createdAt),
      completedAt: this.normalizeIsoString(item.completedAt),
    };
  }

  private normalizeGuestStep(
    raw: unknown,
    index: number,
    goalIds: Set<string>,
    fallbackGoalId: string,
    goalById: Map<string, GuestImportGoal>,
  ): GuestImportStep | null {
    const item = this.asRecord(raw);
    const title = this.readString(item.title)?.slice(0, 160);
    if (!title) return null;
    const sourceGoalId = this.readString(item.weeklyMissionId) || fallbackGoalId;
    const resolvedGoalId = goalIds.has(sourceGoalId) ? sourceGoalId : fallbackGoalId;
    const seconds = Math.max(1, Math.min(1800, this.readNumber(item.estimatedSeconds, 30)));
    const grade = this.normalizeGrade(this.readString(item.grade), seconds);
    return {
      sourceId: this.readString(item.id) || `guest-step-${index + 1}`,
      sourceGoalId: resolvedGoalId,
      title,
      successCriterion: this.readString(item.successCriterion)?.slice(0, 180) || `${title} 완료`,
      category: this.normalizeCategory(this.readString(item.category) || goalById.get(resolvedGoalId)?.category),
      phase: this.normalizePhase(this.readString(item.phase)),
      orderIndex: Math.max(0, this.readNumber(item.orderIndex, index)),
      estimatedSeconds: seconds,
      grade,
      status: this.normalizeGuestStepStatus(this.readString(item.status)),
      activatedAt: this.normalizeIsoString(item.activatedAt),
      completedAt: this.normalizeIsoString(item.completedAt),
    };
  }

  private normalizeGuestAttempt(raw: unknown): GuestImportAttempt | null {
    const item = this.asRecord(raw);
    const sourceStepId = this.readString(item.stepId);
    const action = this.normalizeAttemptAction(this.readString(item.action));
    if (!sourceStepId || !action) return null;
    return {
      sourceStepId,
      action,
      reason: this.readString(item.reason)?.slice(0, 40) || null,
    };
  }

  private normalizeGuestStepStatus(value?: string): GuestImportStep['status'] {
    if (value === 'DONE' || value === 'completed') return 'completed';
    if (value === 'OPEN' || value === 'active') return 'active';
    if (value === 'DEFERRED' || value === 'deferred') return 'deferred';
    if (value === 'SKIPPED' || value === 'skipped') return 'skipped';
    if (value === 'REPLACED' || value === 'replaced') return 'replaced';
    return 'pending';
  }

  private normalizeAttemptAction(value?: string): GuestImportAttempt['action'] | null {
    if (value === 'complete' || value === 'shrink' || value === 'defer' || value === 'skip' || value === 'undo' || value === 'costume_active') {
      return value;
    }
    return null;
  }

  private normalizeCategory(value?: string): QuestCategory {
    const categories: QuestCategory[] = ['study', 'work', 'writing', 'cleaning', 'exercise', 'wake', 'sleep', 'life_admin', 'relationship'];
    return categories.includes(value as QuestCategory) ? value as QuestCategory : 'study';
  }

  private normalizePhase(value?: string): StepPhase {
    const phases: StepPhase[] = ['orient', 'prepare', 'open', 'start', 'continue', 'close'];
    return phases.includes(value as StepPhase) ? value as StepPhase : 'start';
  }

  private normalizeGrade(value: string | undefined, seconds: number): QuestGrade {
    const grades: QuestGrade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    return grades.includes(value as QuestGrade) ? value as QuestGrade : gradeForSeconds(seconds);
  }

  private normalizeBurdenLevel(value: number): BurdenLevel {
    if (value === 1 || value === 2 || value === 3 || value === 4) return value;
    return 2;
  }

  private safeCostumeId(costumeId: string): string {
    if (costumeId === 'one_punch_hero' && !isSuperModeAllowed()) return 'starter_mage';
    return this.availableCostumes().some((costume) => costume.id === costumeId) ? costumeId : 'starter_mage';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readNumber(value: unknown, fallback: number): number {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  private normalizeIsoString(value: unknown): string | null {
    const text = this.readString(value);
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private async ensureUserState(executor: SqlExecutor, userId: number): Promise<void> {
    await executor.query(
      `INSERT INTO currencies (user_id, idle_gold, goal_coin)
       VALUES ($1, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    await executor.query(
      `INSERT INTO consistency_states
         (user_id, current_streak_days, best_streak_days, execution_rate_14d, consistency_score, streak_recover_tokens)
       VALUES ($1, 0, 0, 0, 0, 1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    await executor.query(
      `INSERT INTO stepquest_user_states (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    for (const facility of FACILITIES) {
      await executor.query(
        `INSERT INTO stepquest_village_facilities (user_id, facility_key)
         VALUES ($1, $2)
         ON CONFLICT (user_id, facility_key) DO NOTHING`,
        [userId, facility],
      );
    }
  }

  private goalMetadataRule(body: CreateStepQuestGoalDto): string | null {
    const metadata = {
      recurrenceRule: body.recurrenceRule || null,
      location: body.location || null,
      availableMinutes: body.availableMinutes || null,
      obstacle: body.obstacle || null,
    };
    return Object.values(metadata).some((value) => value !== null) ? JSON.stringify(metadata) : null;
  }

  private parseGoalMetadata(value: string | null): {
    location?: string;
    availableMinutes?: number;
    obstacle?: FailureReason;
    energyLevel?: EnergyLevel;
  } {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value) as {
        location?: unknown;
        availableMinutes?: unknown;
        obstacle?: unknown;
        energyLevel?: unknown;
      };
      return {
        location: typeof parsed.location === 'string' ? parsed.location : undefined,
        availableMinutes: Number.isInteger(parsed.availableMinutes) ? Number(parsed.availableMinutes) : undefined,
        obstacle: typeof parsed.obstacle === 'string' ? this.normalizeRegenerateReason(parsed.obstacle) : undefined,
        energyLevel: parsed.energyLevel === 'low' || parsed.energyLevel === 'medium' || parsed.energyLevel === 'high'
          ? parsed.energyLevel
          : undefined,
      };
    } catch {
      return {};
    }
  }

  private normalizeRegenerateReason(reason?: string): FailureReason {
    const allowed: FailureReason[] = ['too_big', 'no_material', 'unclear', 'tired', 'wrong_place', 'not_now', 'forgot', 'anxious'];
    return allowed.includes(reason as FailureReason) ? reason as FailureReason : 'too_big';
  }

  private async disableReminder(userId: number): Promise<void> {
    await this.db.query(
      `UPDATE stepquest_reminders
       SET enabled = FALSE, updated_at = NOW()
       WHERE user_id = $1`,
      [userId],
    );
  }

  private async getUserState(userId: number, executor: SqlExecutor = this.db) {
    const result = await executor.query(
      `SELECT
         sus.user_id AS "userId",
         sus.level,
         sus.xp,
         sus.material,
         COALESCE(c.goal_coin, sus.material) AS "goalCoin",
         sus.return_marks AS "returnMarks",
         sus.equipped_costume_id AS "equippedCostumeId",
         sus.last_active_at AS "lastActiveAt"
       FROM stepquest_user_states sus
       LEFT JOIN currencies c ON c.user_id = sus.user_id
       WHERE sus.user_id = $1`,
      [userId],
    );
    return result.rows[0];
  }

  private async getConsistencyState(userId: number, executor: SqlExecutor = this.db) {
    const result = await executor.query(
      `SELECT
         user_id AS "userId",
         current_streak_days AS "currentStreakDays",
         best_streak_days AS "bestStreakDays",
         execution_rate_14d::float8 AS "executionRate14d",
         consistency_score AS "consistencyScore",
         streak_recover_tokens AS "streakRecoverTokens",
         updated_at AS "updatedAt"
       FROM consistency_states
       WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? {
      userId,
      currentStreakDays: 0,
      bestStreakDays: 0,
      executionRate14d: 0,
      consistencyScore: 0,
      streakRecoverTokens: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  private async updateConsistency(client: PoolClient, userId: number) {
    const counts = await client.query<{ planned: number; done: number }>(
      `SELECT
         (
           (SELECT COUNT(*)::int FROM micro_actions WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '14 days')
           +
           (SELECT COUNT(*)::int
            FROM stepquest_micro_steps ms
            JOIN stepquest_chains c ON c.id = ms.chain_id
            JOIN stepquest_goals g ON g.id = c.goal_id
            WHERE g.user_id = $1 AND ms.created_at >= NOW() - INTERVAL '14 days')
         ) AS planned,
         (
           (SELECT COUNT(*)::int FROM micro_action_logs WHERE user_id = $1 AND result = 'DONE' AND executed_at >= NOW() - INTERVAL '14 days')
           +
           (SELECT COUNT(*)::int
            FROM stepquest_micro_steps ms
            JOIN stepquest_chains c ON c.id = ms.chain_id
            JOIN stepquest_goals g ON g.id = c.goal_id
            WHERE g.user_id = $1 AND ms.status = 'completed' AND ms.completed_at >= NOW() - INTERVAL '14 days')
         ) AS done`,
      [userId],
    );

    const planned = counts.rows[0]?.planned || 0;
    const done = counts.rows[0]?.done || 0;
    const executionRate14d = planned <= 0 ? 0 : Math.min(1, done / planned);
    const doneDates = await client.query<{ doneDate: string }>(
      `SELECT done_date AS "doneDate"
       FROM (
         SELECT DISTINCT (executed_at AT TIME ZONE 'UTC')::date::text AS done_date
         FROM micro_action_logs
         WHERE user_id = $1 AND result = 'DONE'
         UNION
         SELECT DISTINCT (ms.completed_at AT TIME ZONE 'UTC')::date::text AS done_date
         FROM stepquest_micro_steps ms
         JOIN stepquest_chains c ON c.id = ms.chain_id
         JOIN stepquest_goals g ON g.id = c.goal_id
         WHERE g.user_id = $1
           AND ms.status = 'completed'
           AND ms.completed_at IS NOT NULL
       ) days
       ORDER BY done_date DESC
       LIMIT 30`,
      [userId],
    );

    const dateSet = new Set(doneDates.rows.map((row) => row.doneDate));
    let streak = 0;
    const cursor = new Date();
    for (let index = 0; index < 30; index += 1) {
      const key = cursor.toISOString().slice(0, 10);
      if (!dateSet.has(key)) break;
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    const streakFactor = Math.min(streak / 14, 1);
    const consistencyScore = Math.round(executionRate14d * 70 + streakFactor * 30);
    const updated = await client.query(
      `UPDATE consistency_states
       SET
         current_streak_days = $2,
         best_streak_days = GREATEST(best_streak_days, $2),
         execution_rate_14d = $3,
         consistency_score = $4,
         last_streak_updated_at = NOW(),
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING
         user_id AS "userId",
         current_streak_days AS "currentStreakDays",
         best_streak_days AS "bestStreakDays",
         execution_rate_14d::float8 AS "executionRate14d",
         consistency_score AS "consistencyScore",
         streak_recover_tokens AS "streakRecoverTokens",
         updated_at AS "updatedAt"`,
      [userId, streak, executionRate14d, consistencyScore],
    );

    return updated.rows[0];
  }

  private async getVillage(userId: number) {
    const result = await this.db.query(
      `SELECT
         facility_key AS "facilityKey",
         level,
         xp,
         material,
         updated_at AS "updatedAt"
       FROM stepquest_village_facilities
       WHERE user_id = $1
       ORDER BY facility_key`,
      [userId],
    );
    return result.rows;
  }

  private async getCostumeProgress(userId: number) {
    const categoryRows = await this.db.query<{
      category: QuestCategory;
      count: number;
    }>(
      `SELECT g.category, COUNT(ms.id)::int AS count
       FROM stepquest_micro_steps ms
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       WHERE g.user_id = $1
         AND ms.status = 'completed'
       GROUP BY g.category`,
      [userId],
    );
    const totals = await this.db.query<{
      completedSteps: number;
      returnSessions: number;
    }>(
      `SELECT
         (SELECT COUNT(ms.id)::int
          FROM stepquest_micro_steps ms
          JOIN stepquest_chains c ON c.id = ms.chain_id
          JOIN stepquest_goals g ON g.id = c.goal_id
          WHERE g.user_id = $1 AND ms.status = 'completed') AS "completedSteps",
         (SELECT COUNT(id)::int
          FROM stepquest_return_sessions
          WHERE user_id = $1) AS "returnSessions"`,
      [userId],
    );

    return {
      categoryCompleted: categoryRows.rows.reduce<Record<string, number>>((memo, row) => {
        memo[row.category] = row.count;
        return memo;
      }, {}),
      completedSteps: totals.rows[0]?.completedSteps || 0,
      returnSessions: totals.rows[0]?.returnSessions || 0,
    };
  }

  private mapCostume(
    costume: StepQuestCostumeDefinition,
    equippedCostumeId: string,
    progress: CostumeProgress,
    activeCharge?: CostumeActiveCharge,
  ) {
    const current = this.costumeCurrentValue(costume, progress);
    const target = costume.target;
    const unlocked = costume.metric === 'always' || current >= target;
    const xp = costume.metric === 'always' ? progress.completedSteps : current;
    return {
      ...costume,
      equipped: costume.id === equippedCostumeId,
      unlocked,
      level: Math.floor(xp / 5) + 1,
      xp,
      progress: {
        current: Math.min(current, target),
        target,
        percent: target ? Math.min(100, Math.round((current / target) * 100)) : 100,
      },
      activeCharge: activeCharge || this.readyCostumeActiveCharge(),
    };
  }

  private availableCostumes(): StepQuestCostumeDefinition[] {
    return isSuperModeAllowed()
      ? COSTUMES
      : COSTUMES.filter((costume) => costume.id !== 'one_punch_hero');
  }

  private async getCostumeActiveCharge(executor: SqlExecutor, userId: number, costumeId: string): Promise<CostumeActiveCharge> {
    const latest = await executor.query<{ lastUsedAt: string }>(
      `SELECT created_at AS "lastUsedAt"
       FROM stepquest_step_attempts
       WHERE user_id = $1
         AND action = 'costume_active'
         AND reason = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, costumeId],
    );
    const lastUsedAt = latest.rows[0]?.lastUsedAt || null;
    if (!lastUsedAt) return this.readyCostumeActiveCharge();

    const completed = await executor.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM stepquest_step_attempts
       WHERE user_id = $1
         AND action = 'complete'
         AND created_at > $2`,
      [userId, lastUsedAt],
    );
    const completedSinceUse = Number(completed.rows[0]?.count || 0);
    const remaining = Math.max(0, COSTUME_ACTIVE_RECHARGE_STEPS - completedSinceUse);
    return {
      available: remaining === 0,
      completedSinceUse,
      required: COSTUME_ACTIVE_RECHARGE_STEPS,
      remaining,
      lastUsedAt,
    };
  }

  private readyCostumeActiveCharge(): CostumeActiveCharge {
    return {
      available: true,
      completedSinceUse: COSTUME_ACTIVE_RECHARGE_STEPS,
      required: COSTUME_ACTIVE_RECHARGE_STEPS,
      remaining: 0,
      lastUsedAt: null,
    };
  }

  private depletedCostumeActiveCharge(): CostumeActiveCharge {
    return {
      available: false,
      completedSinceUse: 0,
      required: COSTUME_ACTIVE_RECHARGE_STEPS,
      remaining: COSTUME_ACTIVE_RECHARGE_STEPS,
      lastUsedAt: new Date().toISOString(),
    };
  }

  private async assertCostumeActiveAvailable(executor: SqlExecutor, userId: number, costumeId: string): Promise<void> {
    const charge = await this.getCostumeActiveCharge(executor, userId, costumeId);
    if (!charge.available) {
      throw new BadRequestException(`\uCF54\uC2A4\uD2AC \uB2A5\uB825\uC740 ${charge.remaining}\uAC1C \uD589\uB3D9\uC744 \uB354 \uC644\uB8CC\uD558\uBA74 \uB2E4\uC2DC \uCDA9\uC804\uB429\uB2C8\uB2E4.`);
    }
  }

  private async recordCostumeActiveUse(executor: SqlExecutor, userId: number, stepId: number, costumeId: string): Promise<void> {
    await executor.query(
      `INSERT INTO stepquest_step_attempts (step_id, user_id, action, reason)
       VALUES ($1, $2, 'costume_active', $3)`,
      [stepId, userId, costumeId],
    );
  }

  private costumeCurrentValue(
    costume: StepQuestCostumeDefinition,
    progress: CostumeProgress,
  ): number {
    if (costume.metric === 'always') return costume.target;
    if (costume.metric === 'total_completed') return progress.completedSteps;
    if (costume.metric === 'return_sessions') return progress.returnSessions;
    if (costume.metric === 'category_completed' && costume.category) {
      return progress.categoryCompleted[costume.category] || 0;
    }
    return 0;
  }

  private costumeRewardMultiplier(costumeId: string, category: QuestCategory, sessionCombo: number, isReturnStep: boolean): number {
    if (costumeId === 'one_punch_hero' && !isSuperModeAllowed()) return 1;
    if (costumeId === 'starter_mage' && sessionCombo <= 1) return 1.2;
    if (costumeId === 'focus_archer' && category === 'study') return 1.15;
    if (costumeId === 'return_paladin' && isReturnStep) return 1.3;
    if (costumeId === 'tidy_rogue' && category === 'cleaning') return 1.2;
    if (costumeId === 'blank_scribe' && category === 'writing') return 1.2;
    if (costumeId === 'dawn_knight' && category === 'wake') return 1.2;
    if (costumeId === 'one_punch_hero') return 3;
    return 1;
  }

  private async getActiveChainSnapshot(userId: number, preferredChainId?: number) {
    const chain = await this.db.query(
      `SELECT
         c.id AS "chainId",
         c.goal_id AS "goalId",
         c.revision,
         c.status,
         g.title AS "goalTitle",
         COUNT(ms.id)::int AS "totalSteps",
         COUNT(ms.id) FILTER (WHERE ms.status = 'completed')::int AS "completedSteps"
       FROM stepquest_chains c
       JOIN stepquest_goals g ON g.id = c.goal_id
       LEFT JOIN stepquest_micro_steps ms ON ms.chain_id = c.id
       WHERE g.user_id = $1
         AND g.status = 'active'
         AND c.status = 'active'
         AND ($2::int IS NULL OR c.id = $2)
       GROUP BY c.id, g.title
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT 1`,
      [userId, preferredChainId ?? null],
    );

    if (!chain.rowCount) return { chain: null, steps: [] };

    const steps = await this.db.query(
      `SELECT
         id AS "stepId",
         chain_id AS "chainId",
         title,
         success_criterion AS "successCriterion",
         phase,
         order_index AS "orderIndex",
         estimated_seconds AS "estimatedSeconds",
         grade,
         status,
         xp_reward AS "xpReward",
         facility_reward AS "facilityReward",
         activated_at AS "activatedAt",
         completed_at AS "completedAt"
       FROM stepquest_micro_steps
       WHERE chain_id = $1
       ORDER BY order_index ASC, id ASC`,
      [chain.rows[0].chainId],
    );

    return {
      chain: chain.rows[0],
      steps: steps.rows,
    };
  }

  private async findCurrentStep(executor: SqlExecutor, userId: number): Promise<CurrentStepRow | null> {
    const result = await executor.query<CurrentStepRow>(
      `SELECT
         ms.id AS "stepId",
         ms.chain_id AS "chainId",
         g.id AS "goalId",
         g.user_id AS "userId",
         ms.title,
         ms.success_criterion AS "successCriterion",
         ms.phase,
         ms.order_index AS "orderIndex",
         ms.estimated_seconds AS "estimatedSeconds",
         ms.grade,
         ms.status,
         ms.xp_reward AS "xpReward",
         ms.facility_reward AS "facilityReward",
         g.category,
         g.title AS "goalTitle"
       FROM stepquest_micro_steps ms
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       WHERE g.user_id = $1
         AND g.status = 'active'
         AND c.status = 'active'
         AND ms.status = 'active'
       ORDER BY ms.activated_at ASC, ms.id ASC
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  private async findDeferredStep(executor: SqlExecutor, userId: number): Promise<CurrentStepRow | null> {
    const result = await executor.query<CurrentStepRow>(
      `SELECT
         ms.id AS "stepId",
         ms.chain_id AS "chainId",
         g.id AS "goalId",
         g.user_id AS "userId",
         ms.title,
         ms.success_criterion AS "successCriterion",
         ms.phase,
         ms.order_index AS "orderIndex",
         ms.estimated_seconds AS "estimatedSeconds",
         ms.grade,
         ms.status,
         ms.xp_reward AS "xpReward",
         ms.facility_reward AS "facilityReward",
         g.category,
         g.title AS "goalTitle",
         deferred_attempt.created_at AS "deferredAt"
       FROM stepquest_micro_steps ms
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       LEFT JOIN LATERAL (
         SELECT a.created_at
         FROM stepquest_step_attempts a
         WHERE a.step_id = ms.id
           AND a.user_id = $1
           AND a.action = 'defer'
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT 1
       ) deferred_attempt ON TRUE
       WHERE g.user_id = $1
         AND g.status = 'active'
         AND c.status = 'active'
         AND ms.status = 'deferred'
       ORDER BY COALESCE(deferred_attempt.created_at, ms.activated_at, NOW()) DESC, ms.id DESC
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  private async findReentryStep(client: PoolClient, userId: number): Promise<CurrentStepRow | null> {
    const result = await client.query<CurrentStepRow>(
      `SELECT
         ms.id AS "stepId",
         ms.chain_id AS "chainId",
         g.id AS "goalId",
         g.user_id AS "userId",
         ms.title,
         ms.success_criterion AS "successCriterion",
         ms.phase,
         ms.order_index AS "orderIndex",
         ms.estimated_seconds AS "estimatedSeconds",
         ms.grade,
         ms.status,
         ms.xp_reward AS "xpReward",
         ms.facility_reward AS "facilityReward",
         g.category,
         g.title AS "goalTitle"
       FROM stepquest_micro_steps ms
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       WHERE g.user_id = $1
         AND g.status = 'active'
         AND c.status = 'active'
         AND ms.status IN ('active', 'deferred', 'pending')
       ORDER BY
         CASE ms.status WHEN 'active' THEN 0 WHEN 'deferred' THEN 1 ELSE 2 END,
         ms.order_index ASC,
         ms.id ASC
       LIMIT 1
       FOR UPDATE OF ms`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  private async lockStep(client: PoolClient, userId: number, stepId: number): Promise<CurrentStepRow> {
    return this.lockStepForStatuses(client, userId, stepId, ['active']);
  }

  private async lockStepForStatuses(
    client: PoolClient,
    userId: number,
    stepId: number,
    statuses: string[],
  ): Promise<CurrentStepRow> {
    const result = await client.query<CurrentStepRow>(
      `SELECT
         ms.id AS "stepId",
         ms.chain_id AS "chainId",
         g.id AS "goalId",
         g.user_id AS "userId",
         ms.title,
         ms.success_criterion AS "successCriterion",
         ms.phase,
         ms.order_index AS "orderIndex",
         ms.estimated_seconds AS "estimatedSeconds",
         ms.grade,
         ms.status,
         ms.xp_reward AS "xpReward",
         ms.facility_reward AS "facilityReward",
         g.category,
         g.title AS "goalTitle"
       FROM stepquest_micro_steps ms
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       WHERE g.user_id = $1
         AND ms.id = $2
         AND ms.status = ANY($3::text[])
       FOR UPDATE OF ms`,
      [userId, stepId, statuses],
    );

    if (!result.rowCount) {
      throw new NotFoundException('\uD604\uC7AC STEPQUEST \uD589\uB3D9\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    }
    return result.rows[0];
  }

  private async lockCompletedStep(client: PoolClient, userId: number, stepId: number): Promise<CurrentStepRow> {
    const result = await client.query<CurrentStepRow>(
      `SELECT
         ms.id AS "stepId",
         ms.chain_id AS "chainId",
         g.id AS "goalId",
         g.user_id AS "userId",
         ms.title,
         ms.success_criterion AS "successCriterion",
         ms.phase,
         ms.order_index AS "orderIndex",
         ms.estimated_seconds AS "estimatedSeconds",
         ms.grade,
         ms.status,
         ms.xp_reward AS "xpReward",
         ms.facility_reward AS "facilityReward",
         g.category,
         g.title AS "goalTitle"
       FROM stepquest_micro_steps ms
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       WHERE g.user_id = $1
         AND ms.id = $2
         AND ms.status = 'completed'
       FOR UPDATE OF ms`,
      [userId, stepId],
    );

    if (!result.rowCount) {
      throw new NotFoundException('\uB418\uB3CC\uB9B4 \uC644\uB8CC \uD589\uB3D9\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    }
    return result.rows[0];
  }

  private async activateNextPendingStep(client: PoolClient, userId: number, chainId: number) {
    const next = await client.query<{ id: number }>(
      `SELECT ms.id
       FROM stepquest_micro_steps ms
       JOIN stepquest_chains c ON c.id = ms.chain_id
       JOIN stepquest_goals g ON g.id = c.goal_id
       WHERE ms.chain_id = $1
         AND g.user_id = $2
         AND ms.status = 'pending'
       ORDER BY ms.order_index ASC, ms.id ASC
       LIMIT 1`,
      [chainId, userId],
    );

    if (!next.rowCount) return null;
    await client.query(
      `UPDATE stepquest_micro_steps
       SET status = 'active', activated_at = NOW()
       WHERE id = $1`,
      [next.rows[0].id],
    );
    return this.findCurrentStep(client, userId);
  }

  private async grantReward(
    client: PoolClient,
    userId: number,
    sourceType: 'step' | 'return' | 'achievement',
    sourceId: number,
    rewardType: 'xp' | 'facility_xp' | 'return_mark' | 'costume_fragment',
    amount: number,
    idempotencyKey: string,
  ): Promise<void> {
    const inserted = await client.query(
      `INSERT INTO stepquest_reward_transactions
         (user_id, source_type, source_id, reward_type, amount, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [userId, sourceType, sourceId, rewardType, amount, idempotencyKey],
    );

    if (!inserted.rowCount) return;
    if (rewardType === 'xp') {
      await client.query(
        `UPDATE stepquest_user_states
         SET xp = xp + $2, level = FLOOR((xp + $2) / 10) + 1, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, amount],
      );
    }
    if (rewardType === 'facility_xp') {
      await client.query(
        `UPDATE stepquest_user_states
         SET material = material + $2, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, amount],
      );
      await client.query(
        `UPDATE currencies
         SET goal_coin = goal_coin + $2, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, amount],
      );
    }
    if (rewardType === 'return_mark') {
      await client.query(
        `UPDATE stepquest_user_states
         SET return_marks = return_marks + $2, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, amount],
      );
    }
  }

  private async growVillage(client: PoolClient, userId: number, category: QuestCategory, facilityXp: number): Promise<void> {
    const facilityKey = FACILITY_BY_CATEGORY[category];
    await client.query(
      `UPDATE stepquest_village_facilities
       SET
         xp = xp + $3,
         material = material + 1,
         level = FLOOR((xp + $3) / 5) + 1,
         updated_at = NOW()
       WHERE user_id = $1 AND facility_key = $2`,
      [userId, facilityKey, facilityXp],
    );
  }

  private async shrinkVillage(client: PoolClient, userId: number, category: QuestCategory, facilityXp: number): Promise<void> {
    const facilityKey = FACILITY_BY_CATEGORY[category];
    await client.query(
      `UPDATE stepquest_village_facilities
       SET
         xp = GREATEST(0, xp - $3),
         material = GREATEST(0, material - 1),
         level = FLOOR(GREATEST(0, xp - $3) / 5) + 1,
         updated_at = NOW()
       WHERE user_id = $1 AND facility_key = $2`,
      [userId, facilityKey, facilityXp],
    );
  }

  private async touchUser(executor: SqlExecutor, userId: number): Promise<void> {
    await executor.query(
      `UPDATE stepquest_user_states
       SET last_active_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [userId],
    );
  }
}
