// 전투 엔진 - 턴제 전투 시스템
import { SKILLS } from '../config/skills.js';
import { BOSSES } from '../config/bosses.js';

export class BattleEngine {
  constructor() {
    this.battleState = null;
    this.battleLog = [];
  }

  // 전투 시작
  initBattle(character, bossId) {
    const boss = BOSSES[bossId];
    if (!boss) throw new Error('존재하지 않는 보스입니다.');

    this.battleLog = [];
    this.battleState = {
      turn: 0,
      phase: 'player', // 'player' or 'boss'
      isOver: false,
      result: null,

      player: {
        ...character,
        currentHp: character.combatStats.maxHp,
        currentMp: character.combatStats.maxMp,
        buffs: [],
        debuffs: []
      },

      boss: {
        ...boss,
        currentHp: boss.stats.maxHp,
        buffs: [],
        debuffs: []
      }
    };

    // 선공 결정 (민첩 비교)
    const playerSpeed = character.combatStats.dodgeRate; // 민첩 기반
    const bossSpeed = boss.stats.speed;

    if (bossSpeed > playerSpeed) {
      this.battleState.phase = 'boss';
    }

    this.addLog(`${boss.name}과(와)의 전투가 시작되었습니다!`);
    return this.battleState;
  }

  // 로그 추가
  addLog(message, type = 'normal') {
    this.battleLog.push({
      turn: this.battleState.turn,
      message,
      type,
      timestamp: Date.now()
    });
  }

  // 플레이어 행동
  playerAction(skillId) {
    if (this.battleState.isOver) return null;
    if (this.battleState.phase !== 'player') return null;

    const player = this.battleState.player;
    const boss = this.battleState.boss;
    const skill = SKILLS[skillId];

    if (!skill) {
      this.addLog('알 수 없는 스킬입니다.', 'error');
      return null;
    }

    // MP 체크
    if (player.currentMp < skill.mpCost) {
      this.addLog('MP가 부족합니다!', 'error');
      return null;
    }

    // MP 소모
    player.currentMp -= skill.mpCost;

    // 스킬 타입별 처리
    let result;
    switch (skill.type) {
      case 'attack':
      case 'magic':
        result = this.executeAttack(player, boss, skill, true);
        break;
      case 'heal':
        result = this.executeHeal(player, skill);
        break;
      case 'buff':
        result = this.executeBuff(player, skill);
        break;
      default:
        result = this.executeAttack(player, boss, skill, true);
    }

    // 보스 사망 체크
    if (boss.currentHp <= 0) {
      this.battleState.isOver = true;
      this.battleState.result = 'victory';
      this.addLog(`${boss.name}을(를) 쓰러뜨렸습니다!`, 'victory');
      return this.getBattleResult();
    }

    // 턴 종료, 보스 턴으로
    this.battleState.phase = 'boss';
    return result;
  }

  // 보스 행동 (AI)
  bossAction() {
    if (this.battleState.isOver) return null;
    if (this.battleState.phase !== 'boss') return null;

    const boss = this.battleState.boss;
    const player = this.battleState.player;

    // 스턴 체크
    const stunDebuff = boss.debuffs.find(d => d.type === 'stun');
    if (stunDebuff) {
      this.addLog(`${boss.name}은(는) 마비되어 행동할 수 없습니다!`, 'debuff');
      this.processBuffs(boss);
      this.battleState.phase = 'player';
      this.battleState.turn++;
      return { action: 'stunned' };
    }

    // 스킬 선택 (가중치 기반)
    const skill = this.selectBossSkill(boss);

    // 스킬 실행
    let result;
    if (skill.type === 'buff') {
      result = this.executeBossBuff(boss, skill);
    } else if (skill.type === 'heal') {
      result = this.executeBossHeal(boss, skill);
    } else if (skill.type === 'stun') {
      result = this.executeBossStun(player, skill);
    } else {
      result = this.executeAttack(boss, player, skill, false);
    }

    // 플레이어 사망 체크
    if (player.currentHp <= 0) {
      this.battleState.isOver = true;
      this.battleState.result = 'defeat';
      this.addLog('쓰러졌습니다...', 'defeat');
      return this.getBattleResult();
    }

    // 버프/디버프 처리
    this.processBuffs(player);
    this.processBuffs(boss);

    // 턴 종료, 플레이어 턴으로
    this.battleState.phase = 'player';
    this.battleState.turn++;

    return result;
  }

  // 공격 실행
  executeAttack(attacker, defender, skill, isPlayer) {
    const hits = skill.hits || 1;
    let totalDamage = 0;
    let criticalHit = false;

    for (let i = 0; i < hits; i++) {
      // 회피 체크
      if (this.checkDodge(defender, isPlayer)) {
        this.addLog(isPlayer ? `${this.battleState.boss.name}이(가) 회피했습니다!` : '공격을 회피했습니다!', 'dodge');
        continue;
      }

      // 데미지 계산
      const damageResult = this.calculateDamage(attacker, defender, skill, isPlayer);
      totalDamage += damageResult.damage;
      if (damageResult.isCritical) criticalHit = true;

      defender.currentHp = Math.max(0, defender.currentHp - damageResult.damage);
    }

    // 로그
    if (totalDamage > 0) {
      const critText = criticalHit ? ' (크리티컬!)' : '';
      const name = isPlayer ? '당신' : this.battleState.boss.name;
      this.addLog(`${name}의 ${skill.name}! ${totalDamage} 데미지${critText}`, isPlayer ? 'player-attack' : 'boss-attack');
    }

    // 흡혈 효과
    if (skill.lifesteal && totalDamage > 0) {
      const healAmount = Math.floor(totalDamage * skill.lifesteal / 100);
      attacker.currentHp = Math.min(attacker.currentHp + healAmount,
        isPlayer ? attacker.combatStats.maxHp : attacker.stats.maxHp);
      this.addLog(`HP ${healAmount} 흡수!`, 'heal');
    }

    // 추가 효과 (디버프 등)
    if (skill.effect && skill.effect.type === 'debuff') {
      defender.debuffs.push({
        ...skill.effect,
        remainingTurns: skill.effect.duration
      });
      this.addLog(`${defender === this.battleState.player ? '당신' : this.battleState.boss.name}에게 디버프 적용!`, 'debuff');
    }

    return { damage: totalDamage, critical: criticalHit };
  }

  // 데미지 계산
  calculateDamage(attacker, defender, skill, isPlayer) {
    let baseAttack;
    let defense;

    if (isPlayer) {
      baseAttack = skill.damageType === 'magical'
        ? attacker.combatStats.magicAttack
        : attacker.combatStats.attack;
      defense = defender.stats.defense;
    } else {
      baseAttack = skill.damageType === 'magical'
        ? attacker.stats.magicAttack
        : attacker.stats.attack;
      defense = attacker.combatStats?.defense || 0;
    }

    // 버프/디버프 적용
    const attackBuff = attacker.buffs
      .filter(b => b.stat === 'attack')
      .reduce((sum, b) => sum + (b.isPercent ? baseAttack * b.value / 100 : b.value), 0);
    baseAttack += attackBuff;

    const defenseBuff = defender.buffs
      .filter(b => b.stat === 'defense')
      .reduce((sum, b) => sum + (b.isPercent ? defense * b.value / 100 : b.value), 0);
    defense += defenseBuff;

    const defenseDebuff = defender.debuffs
      .filter(d => d.stat === 'defense')
      .reduce((sum, d) => sum + d.value, 0);
    defense += defenseDebuff; // 디버프는 음수

    // 기본 데미지
    let damage = baseAttack * skill.multiplier;

    // 방어력 감소 (방어력 / (방어력 + 100))
    const reduction = Math.max(0, defense) / (Math.max(0, defense) + 100);
    damage *= (1 - reduction);

    // 피해 감소 버프
    const damageReduction = defender.buffs.find(b => b.stat === 'damageReduction');
    if (damageReduction) {
      damage *= (1 - damageReduction.value / 100);
    }

    // 크리티컬 판정
    let isCritical = false;
    let critRate = isPlayer ? attacker.combatStats.critRate : 5;
    const critBuff = attacker.buffs.find(b => b.stat === 'critRate');
    if (critBuff) critRate += critBuff.value;

    if (Math.random() * 100 < critRate) {
      isCritical = true;
      const critDamage = isPlayer ? attacker.combatStats.critDamage : 150;
      damage *= critDamage / 100;
    }

    // 데미지 분산 (90% ~ 110%)
    damage *= 0.9 + Math.random() * 0.2;

    return {
      damage: Math.floor(Math.max(1, damage)),
      isCritical
    };
  }

  // 회피 체크
  checkDodge(defender, defenderIsPlayer) {
    const dodgeRate = defenderIsPlayer ? 5 : (defender.combatStats?.dodgeRate || 3);
    return Math.random() * 100 < dodgeRate;
  }

  // 힐 실행
  executeHeal(player, skill) {
    const healAmount = skill.healFormula(player.stats);
    const actualHeal = Math.min(healAmount, player.combatStats.maxHp - player.currentHp);
    player.currentHp += actualHeal;

    this.addLog(`${skill.name}! HP ${actualHeal} 회복!`, 'heal');
    return { heal: actualHeal };
  }

  // 버프 실행
  executeBuff(player, skill) {
    player.buffs.push({
      ...skill.effect,
      remainingTurns: skill.effect.duration
    });

    this.addLog(`${skill.name} 발동! ${skill.effect.duration}턴간 효과 지속.`, 'buff');
    return { buff: skill.effect };
  }

  // 보스 스킬 선택
  selectBossSkill(boss) {
    const totalWeight = boss.skills.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const skill of boss.skills) {
      random -= skill.weight;
      if (random <= 0) return skill;
    }
    return boss.skills[0];
  }

  // 보스 버프
  executeBossBuff(boss, skill) {
    boss.buffs.push({
      ...skill.effect,
      remainingTurns: skill.effect.duration
    });
    this.addLog(`${boss.name}의 ${skill.name}!`, 'boss-buff');
    return { buff: skill.effect };
  }

  // 보스 힐
  executeBossHeal(boss, skill) {
    const healAmount = skill.value;
    boss.currentHp = Math.min(boss.currentHp + healAmount, boss.stats.maxHp);
    this.addLog(`${boss.name}이(가) ${healAmount} 회복!`, 'boss-heal');
    return { heal: healAmount };
  }

  // 보스 스턴
  executeBossStun(player, skill) {
    if (Math.random() * 100 < skill.chance) {
      player.debuffs.push({
        type: 'stun',
        remainingTurns: skill.duration
      });
      this.addLog(`${this.battleState.boss.name}의 ${skill.name}! 마비되었습니다!`, 'debuff');
      return { stunned: true };
    }
    this.addLog(`${this.battleState.boss.name}의 ${skill.name}! 하지만 버텨냈습니다!`, 'resist');
    return { stunned: false };
  }

  // 버프/디버프 처리 (턴 종료 시)
  processBuffs(entity) {
    // 재생 효과
    const regen = entity.buffs.find(b => b.type === 'regen');
    if (regen) {
      const maxHp = entity.combatStats?.maxHp || entity.stats.maxHp;
      const healAmount = Math.floor(maxHp * regen.value / 100);
      entity.currentHp = Math.min(entity.currentHp + healAmount, maxHp);
      this.addLog(`재생 효과로 HP ${healAmount} 회복!`, 'heal');
    }

    // 지속 시간 감소
    entity.buffs = entity.buffs.filter(b => {
      b.remainingTurns--;
      return b.remainingTurns > 0;
    });

    entity.debuffs = entity.debuffs.filter(d => {
      d.remainingTurns--;
      return d.remainingTurns > 0;
    });
  }

  // 전투 결과 반환
  getBattleResult() {
    const state = this.battleState;
    return {
      result: state.result,
      turns: state.turn,
      boss: state.boss,
      player: state.player,
      log: this.battleLog,
      rewards: state.result === 'victory' ? BOSSES[state.boss.id].rewards : null
    };
  }

  // 현재 전투 상태 반환
  getState() {
    return {
      ...this.battleState,
      log: this.battleLog
    };
  }

  // 도망
  flee() {
    this.battleState.isOver = true;
    this.battleState.result = 'flee';
    this.addLog('전투에서 도망쳤습니다.', 'flee');
    return this.getBattleResult();
  }
}
