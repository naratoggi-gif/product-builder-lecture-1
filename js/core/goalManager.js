// 목표 관리자 - 목표 생성, 완료, 연속 달성 추적
import { stateManager } from './stateManager.js';
import { GameEngine } from './gameEngine.js';
import { GAME_CONSTANTS, getStreakBonus } from '../config/constants.js';

export class GoalManager {
  constructor() {
    this.gameEngine = new GameEngine(stateManager);
  }

  // 새 목표 생성
  createGoal(data) {
    const goal = {
      id: 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title: data.title,
      description: data.description || '',
      type: data.type, // 'habit' or 'task'
      difficulty: data.difficulty || 'normal', // easy, normal, hard
      status: 'active',
      createdAt: new Date().toISOString(),

      // 습관 목표 전용
      ...(data.type === 'habit' && {
        frequency: data.frequency || 'daily',
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: null,
        completionHistory: []
      }),

      // 단기 목표 전용
      ...(data.type === 'task' && {
        dueDate: data.dueDate || null,
        completedAt: null
      })
    };

    return stateManager.addGoal(goal);
  }

  // 목표 완료 처리
  completeGoal(goalId) {
    const goals = stateManager.get('goals');
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return { success: false, message: '목표를 찾을 수 없습니다.' };

    const today = new Date().toISOString().split('T')[0];
    let expGained = 0;
    let streakBonus = 0;
    let character = stateManager.get('character');

    if (goal.type === 'habit') {
      // 이미 오늘 완료했는지 확인
      if (goal.lastCompletedDate === today) {
        return { success: false, message: '오늘은 이미 완료했습니다.' };
      }

      // 연속 달성 체크
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak;
      if (goal.lastCompletedDate === yesterdayStr) {
        // 연속 달성
        newStreak = goal.currentStreak + 1;
      } else {
        // 연속 끊김, 새로 시작
        newStreak = 1;
      }

      // 경험치 계산
      streakBonus = getStreakBonus(newStreak);
      expGained = GAME_CONSTANTS.HABIT_BASE_EXP + streakBonus;

      // 목표 업데이트
      stateManager.updateGoal(goalId, {
        currentStreak: newStreak,
        bestStreak: Math.max(goal.bestStreak, newStreak),
        lastCompletedDate: today,
        completionHistory: [
          { date: today, completed: true },
          ...goal.completionHistory.slice(0, 29) // 최근 30일
        ]
      });
    } else {
      // 단기 목표
      expGained = GAME_CONSTANTS.TASK_EXP[goal.difficulty || 'normal'];

      stateManager.updateGoal(goalId, {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
    }

    // 경험치 적용
    const levelResult = this.gameEngine.addExperience(character, expGained);
    stateManager.saveCharacter(character);

    return {
      success: true,
      expGained,
      streakBonus,
      newStreak: goal.type === 'habit' ? (goal.currentStreak + 1) : null,
      levelResult
    };
  }

  // 목표 수정
  updateGoal(goalId, updates) {
    stateManager.updateGoal(goalId, updates);
    return { success: true };
  }

  // 목표 삭제
  deleteGoal(goalId) {
    stateManager.deleteGoal(goalId);
    return { success: true };
  }

  // 목표 보관
  archiveGoal(goalId) {
    stateManager.updateGoal(goalId, { status: 'archived' });
    return { success: true };
  }

  // 오늘의 진행 상황
  getTodayProgress() {
    const habits = stateManager.get('goals').filter(g => g.type === 'habit' && g.status !== 'archived');
    const today = new Date().toISOString().split('T')[0];

    const completed = habits.filter(g => g.lastCompletedDate === today).length;
    const total = habits.length;

    return {
      completed,
      total,
      percentage: total > 0 ? Math.floor((completed / total) * 100) : 0
    };
  }

  // 최장 연속 기록
  getBestStreak() {
    const habits = stateManager.get('goals').filter(g => g.type === 'habit');
    return Math.max(0, ...habits.map(g => g.bestStreak || 0));
  }

  // 총 완료한 목표 수
  getTotalCompleted() {
    const goals = stateManager.get('goals');
    const completedTasks = goals.filter(g => g.type === 'task' && g.status === 'completed').length;
    const habitCompletions = goals
      .filter(g => g.type === 'habit')
      .reduce((sum, g) => sum + (g.completionHistory?.length || 0), 0);

    return completedTasks + habitCompletions;
  }

  // 이번 주 통계
  getWeeklyStats() {
    const goals = stateManager.get('goals');
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    let completedThisWeek = 0;
    let expThisWeek = 0;

    for (const goal of goals) {
      if (goal.type === 'habit' && goal.completionHistory) {
        for (const entry of goal.completionHistory) {
          const entryDate = new Date(entry.date);
          if (entryDate >= weekStart && entry.completed) {
            completedThisWeek++;
            expThisWeek += GAME_CONSTANTS.HABIT_BASE_EXP;
          }
        }
      } else if (goal.type === 'task' && goal.completedAt) {
        const completedDate = new Date(goal.completedAt);
        if (completedDate >= weekStart) {
          completedThisWeek++;
          expThisWeek += GAME_CONSTANTS.TASK_EXP[goal.difficulty || 'normal'];
        }
      }
    }

    return {
      completed: completedThisWeek,
      exp: expThisWeek
    };
  }
}

export const goalManager = new GoalManager();
