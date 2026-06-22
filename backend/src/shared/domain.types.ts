export type MicroStatus = 'OPEN' | 'DONE' | 'SKIPPED' | 'FAILED';
export type VisionStatus = 'OPEN' | 'DONE' | 'ARCHIVED';
export type WeeklyStatus = 'OPEN' | 'DONE' | 'EXPIRED';

export interface VisionGoal {
  id: number;
  userId: number;
  title: string;
  description?: string;
  targetDate: string;
  status: VisionStatus;
  createdAt: string;
  completedAt?: string;
}

export interface WeeklyMission {
  id: number;
  visionGoalId: number;
  userId: number;
  title: string;
  weekStartDate: string;
  weekEndDate: string;
  targetCount: number;
  completedCount: number;
  status: WeeklyStatus;
  createdAt: string;
  completedAt?: string;
}

export interface MicroAction {
  id: number;
  userId: number;
  weeklyMissionId: number;
  title: string;
  estimatedSeconds: number;
  difficulty: number;
  status: MicroStatus;
  createdAt: string;
  completedAt?: string;
}

export interface ConsistencyState {
  userId: number;
  currentStreakDays: number;
  bestStreakDays: number;
  executionRate14d: number;
  consistencyScore: number;
  streakRecoverTokens: number;
  updatedAt: string;
}

export interface Currency {
  userId: number;
  idleGold: number;
  goalCoin: number;
}

export type RequirementType =
  | 'STREAK_DAYS'
  | 'ROUTINE_COUNT'
  | 'WEEKLY_CLEAR_COUNT'
  | 'VISION_CLEAR_COUNT';

export interface CostumeRequirement {
  requirementType: RequirementType;
  operator: 'GTE' | 'EQ';
  targetValue: number;
}

export interface Costume {
  id: number;
  name: string;
  priceGoalCoin: number;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  skillsetId: string;
  requirements: CostumeRequirement[];
}

export interface UserCostume {
  userId: number;
  costumeId: number;
  isEquipped: boolean;
  ownedAt: string;
}
