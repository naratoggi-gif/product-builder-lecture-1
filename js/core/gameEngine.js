// 게임 엔진 - 경험치, 레벨업, 스탯 관리
import { GAME_CONSTANTS, getRequiredExp, getStreakBonus, calculateCombatStats } from '../config/constants.js';
import { canUnlockSkill, getUnlockableSkills, SKILLS } from '../config/skills.js';
import { getClassById, calculateClassStatBonus, getCombatModifiers, BASE_CLASSES, CLASS_TIERS, canAdvanceClass } from '../config/classes.js';

export class GameEngine {
  constructor(stateManager) {
    this.state = stateManager;
  }

  // 캐릭터 초기화 (직업 포함)
  createNewCharacter(name = '모험가', classId = null) {
    const classInfo = classId ? getClassById(classId) : null;

    // 기본 스탯 + 직업 보너스
    const baseStats = { ...GAME_CONSTANTS.INITIAL_STATS };
    if (classInfo && classInfo.statBonus) {
      baseStats.strength += classInfo.statBonus.strength;
      baseStats.vitality += classInfo.statBonus.vitality;
      baseStats.intelligence += classInfo.statBonus.intelligence;
      baseStats.agility += classInfo.statBonus.agility;
    }

    // 직업별 시작 스킬
    const startingSkills = classInfo?.startingSkills || ['basic_attack', 'defend'];

    return {
      name,
      classId: classId || null,
      classHistory: [], // 전직 히스토리
      level: 1,
      currentExp: 0,
      totalExp: 0,
      stats: baseStats,
      statPoints: 0,
      unlockedSkills: [...startingSkills],
      equippedSkills: [startingSkills[0]],
      combatStats: this.calculateCombatStatsWithClass(baseStats, classId)
    };
  }

  // 직업 보정을 적용한 전투 스탯 계산
  calculateCombatStatsWithClass(stats, classId) {
    const baseCombatStats = calculateCombatStats(stats);
    const classInfo = classId ? getClassById(classId) : null;

    if (!classInfo || !classInfo.combatModifiers) {
      return baseCombatStats;
    }

    const mods = classInfo.combatModifiers;

    return {
      maxHp: Math.floor(baseCombatStats.maxHp * (mods.hpBonus || 1)),
      maxMp: Math.floor(baseCombatStats.maxMp * (mods.mpBonus || 1)),
      attack: Math.floor(baseCombatStats.attack * (mods.attackBonus || 1)),
      magicAttack: Math.floor(baseCombatStats.magicAttack * (mods.magicAttackBonus || 1)),
      defense: Math.floor(baseCombatStats.defense * (mods.defenseBonus || 1)),
      critRate: baseCombatStats.critRate * (mods.critRateBonus || 1),
      critDamage: baseCombatStats.critDamage * (mods.critDamageBonus || 1),
      dodgeRate: baseCombatStats.dodgeRate * (mods.dodgeBonus || 1)
    };
  }

  // 전직
  advanceClass(character, targetClassId) {
    const result = canAdvanceClass(character, targetClassId);

    if (!result.canAdvance) {
      return { success: false, message: result.reason };
    }

    const targetClass = getClassById(targetClassId);

    // 이전 직업을 히스토리에 저장
    if (!character.classHistory) {
      character.classHistory = [];
    }
    character.classHistory.push(character.classId);

    // 새 직업으로 변경
    character.classId = targetClassId;

    // 스탯 보너스 적용
    if (targetClass.statBonus) {
      character.stats.strength += targetClass.statBonus.strength;
      character.stats.vitality += targetClass.statBonus.vitality;
      character.stats.intelligence += targetClass.statBonus.intelligence;
      character.stats.agility += targetClass.statBonus.agility;
    }

    // 전투 스탯 재계산
    character.combatStats = this.calculateCombatStatsWithClass(character.stats, targetClassId);

    // 전용 스킬 해금
    if (targetClass.specialSkills) {
      targetClass.specialSkills.forEach(skillId => {
        if (!character.unlockedSkills.includes(skillId)) {
          character.unlockedSkills.push(skillId);
        }
      });
    }

    return {
      success: true,
      newClass: targetClass,
      newSkills: targetClass.specialSkills || []
    };
  }

  // 경험치 추가 및 레벨업 체크
  addExperience(character, exp) {
    const result = {
      expGained: exp,
      leveledUp: false,
      levelsGained: 0,
      statPointsGained: 0,
      newSkillsUnlocked: []
    };

    character.currentExp += exp;
    character.totalExp += exp;

    // 레벨업 체크 (연속 레벨업 가능)
    let requiredExp = getRequiredExp(character.level);
    while (character.currentExp >= requiredExp) {
      character.currentExp -= requiredExp;
      character.level++;
      result.leveledUp = true;
      result.levelsGained++;

      // 스탯 포인트 지급
      let points = GAME_CONSTANTS.STAT_POINTS_PER_LEVEL;
      if (character.level % GAME_CONSTANTS.BONUS_STAT_POINTS_INTERVAL === 0) {
        points += GAME_CONSTANTS.BONUS_STAT_POINTS;
      }
      character.statPoints += points;
      result.statPointsGained += points;

      requiredExp = getRequiredExp(character.level);
    }

    // 새로 해금 가능한 스킬 체크
    const unlockable = getUnlockableSkills(character);
    for (const skill of unlockable) {
      character.unlockedSkills.push(skill.id);
      result.newSkillsUnlocked.push(skill);
    }

    // 전투 스탯 재계산 (직업 보정 포함)
    character.combatStats = this.calculateCombatStatsWithClass(character.stats, character.classId);

    return result;
  }

  // 스탯 포인트 배분
  allocateStat(character, statName, points = 1) {
    if (character.statPoints < points) {
      return { success: false, message: '스탯 포인트가 부족합니다.' };
    }

    if (!character.stats.hasOwnProperty(statName)) {
      return { success: false, message: '잘못된 스탯입니다.' };
    }

    character.stats[statName] += points;
    character.statPoints -= points;
    character.combatStats = this.calculateCombatStatsWithClass(character.stats, character.classId);

    // 새로 해금된 스킬 체크
    const newSkills = [];
    const unlockable = getUnlockableSkills(character);
    for (const skill of unlockable) {
      character.unlockedSkills.push(skill.id);
      newSkills.push(skill);
    }

    return { success: true, newSkillsUnlocked: newSkills };
  }

  // 스킬 장착
  equipSkill(character, skillId) {
    if (!character.unlockedSkills.includes(skillId)) {
      return { success: false, message: '해금되지 않은 스킬입니다.' };
    }

    if (character.equippedSkills.includes(skillId)) {
      return { success: false, message: '이미 장착된 스킬입니다.' };
    }

    if (character.equippedSkills.length >= 4) {
      return { success: false, message: '스킬 슬롯이 가득 찼습니다.' };
    }

    character.equippedSkills.push(skillId);
    return { success: true };
  }

  // 스킬 해제
  unequipSkill(character, skillId) {
    const index = character.equippedSkills.indexOf(skillId);
    if (index === -1) {
      return { success: false, message: '장착되지 않은 스킬입니다.' };
    }

    character.equippedSkills.splice(index, 1);
    return { success: true };
  }

  // 목표 완료 시 경험치 계산
  calculateGoalExp(goal) {
    if (goal.type === 'task') {
      return GAME_CONSTANTS.TASK_EXP[goal.difficulty || 'normal'];
    } else {
      // 습관 목표
      const baseExp = GAME_CONSTANTS.HABIT_BASE_EXP;
      const bonus = getStreakBonus(goal.currentStreak || 0);
      return baseExp + bonus;
    }
  }

  // 레벨 진행률 계산
  getLevelProgress(character) {
    const required = getRequiredExp(character.level);
    return {
      current: character.currentExp,
      required,
      percentage: Math.floor((character.currentExp / required) * 100)
    };
  }

  // 다음 해금 가능한 스킬 힌트
  getNextSkillHints(character) {
    const hints = [];
    for (const skill of Object.values(SKILLS)) {
      if (character.unlockedSkills.includes(skill.id)) continue;

      const req = skill.unlockRequirements;
      const missing = [];

      if (req.level && character.level < req.level) {
        missing.push(`레벨 ${req.level}`);
      }
      if (req.strength && character.stats.strength < req.strength) {
        missing.push(`힘 ${req.strength}`);
      }
      if (req.vitality && character.stats.vitality < req.vitality) {
        missing.push(`체력 ${req.vitality}`);
      }
      if (req.intelligence && character.stats.intelligence < req.intelligence) {
        missing.push(`지능 ${req.intelligence}`);
      }
      if (req.agility && character.stats.agility < req.agility) {
        missing.push(`민첩 ${req.agility}`);
      }

      if (missing.length > 0 && missing.length <= 2) {
        hints.push({
          skill,
          missing
        });
      }
    }

    return hints.slice(0, 3); // 최대 3개 힌트
  }
}
