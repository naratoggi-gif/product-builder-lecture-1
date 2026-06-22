export type QuestCategory =
  | 'study'
  | 'work'
  | 'writing'
  | 'cleaning'
  | 'exercise'
  | 'wake'
  | 'sleep'
  | 'life_admin'
  | 'relationship';

export type EnergyLevel = 'low' | 'medium' | 'high';
export type BurdenLevel = 1 | 2 | 3 | 4;
export type StepPhase = 'orient' | 'prepare' | 'open' | 'start' | 'continue' | 'close';
export type QuestGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface DecomposeGoalInput {
  goalTitle: string;
  category?: QuestCategory | 'auto';
  burdenLevel: BurdenLevel;
  energyLevel: EnergyLevel;
  location?: string;
  availableMinutes?: number;
  obstacle?: FailureReason;
}

export type FailureReason =
  | 'too_big'
  | 'no_material'
  | 'unclear'
  | 'tired'
  | 'wrong_place'
  | 'not_now'
  | 'forgot'
  | 'anxious';

export interface GeneratedStep {
  clientId: string;
  title: string;
  successCriterion: string;
  estimatedSeconds: number;
  phase: StepPhase;
  grade: QuestGrade;
}

export interface DecomposeGoalOutput {
  normalizedGoal: string;
  category: QuestCategory;
  chainTitle: string;
  steps: GeneratedStep[];
  recommendedFirstStepId: string;
  message: string;
  source: 'template' | 'ai';
  explanation?: string;
  fallbackReason?: string;
}

export interface RewardInput {
  grade: QuestGrade;
  sessionCombo: number;
  costumeMultiplier?: number;
  isFirstReturnStep?: boolean;
}

export interface RewardResult {
  xp: number;
  facilityXp: number;
}

interface StepTemplate {
  title: string;
  seconds: number;
  phase: StepPhase;
}

const TEXT = {
  complete: '\uC644\uB8CC',
  entranceOpen: '\uC785\uAD6C \uC5F4\uAE30',
  todayEntranceOnly: '\uC624\uB298\uC740 \uC785\uAD6C\uB9CC \uC5F0\uB2E4.',
  seeDeskDirection: '\uCC45\uC0C1\uC774 \uC788\uB294 \uBC29\uD5A5 \uBCF4\uAE30',
  sitOnChair: '\uC758\uC790\uC5D0 \uC549\uAE30',
  putBookOnDesk: '\uCC45\uC744 \uCC45\uC0C1 \uC704\uC5D0 \uB193\uAE30',
  openTodayPage: '\uC624\uB298 \uBCFC \uD398\uC774\uC9C0 \uC5F4\uAE30',
  readFirstSentence: '\uCCAB \uBB38\uC7A5 \uC77D\uAE30',
  readOneQuestion: '\uBB38\uC81C \uD558\uB098\uC758 \uC9C8\uBB38\uB9CC \uC77D\uAE30',
  startThreeMinuteTimer: '3\uBD84 \uD0C0\uC774\uBA38 \uC2DC\uC791\uD558\uAE30',
  lookAtWorkScreen: '\uC791\uC5C5 \uD654\uBA74 \uBC14\uB77C\uBCF4\uAE30',
  openOneApp: '\uD544\uC694\uD55C \uC571 \uD558\uB098 \uC5F4\uAE30',
  readTopItem: '\uAC00\uC7A5 \uC704 \uD56D\uBAA9 \uD558\uB098 \uC77D\uAE30',
  placeCursorFirstField: '\uCC98\uC74C \uD560 \uCE78\uC5D0 \uCEE4\uC11C \uB193\uAE30',
  typeOneLine: '\uD55C \uC904\uB9CC \uC785\uB825\uD558\uAE30',
  openWritingDoc: '\uC791\uC131\uD560 \uBB38\uC11C \uC5F4\uAE30',
  putCursorInBody: '\uCEE4\uC11C\uB97C \uBCF8\uBB38\uC5D0 \uB193\uAE30',
  writeNameOrTitle: '\uC778\uBB3C \uC774\uB984 \uB610\uB294 \uC81C\uBAA9 \uD558\uB098 \uC4F0\uAE30',
  writeOneSentence: '\uBB38\uC7A5 \uD558\uB098 \uC4F0\uAE30',
  writeWithoutEditing: '3\uBD84 \uB3D9\uC548 \uC218\uC815\uD558\uC9C0 \uC54A\uACE0 \uC774\uC5B4 \uC4F0\uAE30',
  leaveNextSceneMemo: '\uB2E4\uC74C \uC7A5\uBA74 \uBA54\uBAA8 \uD55C \uC904 \uB0A8\uAE30\uAE30',
  lookAtFloorTile: '\uBC14\uB2E5 \uD55C \uCE78 \uBCF4\uAE30',
  pickNearestObject: '\uAC00\uC7A5 \uAC00\uAE4C\uC6B4 \uBB3C\uAC74 \uD558\uB098 \uC9D1\uAE30',
  moveObjectToPlace: '\uADF8 \uBB3C\uAC74\uC744 \uB458 \uC790\uB9AC\uB85C \uC62E\uAE30\uAE30',
  pickOneTrash: '\uC4F0\uB808\uAE30 \uD558\uB098 \uC9D1\uAE30',
  putInTrashCan: '\uC4F0\uB808\uAE30\uD1B5\uC5D0 \uB123\uAE30',
  startTwoMinuteTimer: '2\uBD84 \uD0C0\uC774\uBA38 \uC2DC\uC791\uD558\uAE30',
  putFeetOnFloor: '\uBC1C\uBC14\uB2E5\uC744 \uBC14\uB2E5\uC5D0 \uBD99\uC774\uAE30',
  standUp: '\uC790\uB9AC\uC5D0\uC11C \uC77C\uC5B4\uB098\uAE30',
  rollShouldersOnce: '\uC5B4\uAE68\uB97C \uD55C \uBC88 \uB3CC\uB9AC\uAE30',
  takeExerciseTop: '\uC6B4\uB3D9\uBCF5 \uC0C1\uC758 \uAEBC\uB0B4\uAE30',
  drinkOneSip: '\uBB3C \uD55C \uBAA8\uAE08 \uB9C8\uC2DC\uAE30',
  startStretching: '2\uBD84 \uC2A4\uD2B8\uB808\uCE6D \uC2DC\uC791\uD558\uAE30',
  moveOneFinger: '\uC190\uAC00\uB77D \uD558\uB098 \uC6C0\uC9C1\uC774\uAE30',
  takeOneHandOut: '\uD55C\uCABD \uC190\uC744 \uC774\uBD88 \uBC16\uC73C\uB85C \uBE7C\uAE30',
  takeOneLegOut: '\uD55C\uCABD \uB2E4\uB9AC\uB97C \uC774\uBD88 \uBC16\uC73C\uB85C \uBE7C\uAE30',
  turnBodySide: '\uBAB8\uC744 \uC606\uC73C\uB85C \uB3CC\uB9AC\uAE30',
  raiseUpperBody: '\uC0C1\uCCB4\uB97C \uC138\uC6B0\uAE30',
  seeBedDirection: '\uCE68\uB300\uAC00 \uC788\uB294 \uBC29\uD5A5 \uBCF4\uAE30',
  putPhoneOnCharger: '\uD734\uB300\uD3F0\uC744 \uCDA9\uC804 \uC704\uCE58\uC5D0 \uB193\uAE30',
  turnOffOneLight: '\uBD88 \uD558\uB098 \uB044\uAE30',
  sitOnBlanket: '\uC774\uBD88 \uC704\uC5D0 \uC549\uAE30',
  checkAlarm: '\uC54C\uB78C \uC2DC\uAC04\uC744 \uD655\uC778\uD558\uAE30',
  breatheThreeTimes: '\uB208\uC744 \uAC10\uACE0 \uC228 \uC138 \uBC88 \uC26C\uAE30',
  lookAtAdminItem: '\uCC98\uB9AC\uD560 \uC11C\uB958\uB098 \uC571 \uBCF4\uAE30',
  openFirstScreen: '\uCCAB \uD654\uBA74 \uC5F4\uAE30',
  readRequiredFieldName: '\uD544\uC694\uD55C \uD56D\uBAA9 \uC774\uB984 \uD558\uB098 \uC77D\uAE30',
  fillOneField: '\uD55C \uCE78\uB9CC \uCC44\uC6B0\uAE30',
  checkSaveButton: '\uC800\uC7A5 \uBC84\uD2BC \uC704\uCE58 \uD655\uC778\uD558\uAE30',
  seeContactName: '\uC5F0\uB77D\uD560 \uC0AC\uB78C \uC774\uB984 \uBCF4\uAE30',
  openMessageApp: '\uBA54\uC2DC\uC9C0 \uC571 \uC5F4\uAE30',
  openChat: '\uB300\uD654\uCC3D \uC5F4\uAE30',
  writeFirstWord: '\uCCAB \uB2E8\uC5B4 \uD558\uB098 \uC4F0\uAE30',
  writeShortSentence: '\uC9E7\uC740 \uBB38\uC7A5 \uD558\uB098 \uC4F0\uAE30',
  readBeforeSending: '\uBCF4\uB0B4\uAE30 \uC804\uC5D0 \uD55C \uBC88 \uC77D\uAE30',
  seeBookLocation: '\uCC45\uC774 \uC788\uB294 \uC704\uCE58 \uBCF4\uAE30',
  holdBook: '\uCC45\uC744 \uC190\uC5D0 \uB4E4\uAE30',
  liftCover: '\uD45C\uC9C0\uB97C \uB4E4\uC5B4 \uC62C\uB9AC\uAE30',
  seeDocTitle: '\uBB38\uC11C \uC81C\uBAA9 \uBCF4\uAE30',
  putCursorFirstBodyLine: '\uBCF8\uBB38 \uCCAB \uC904\uC5D0 \uCEE4\uC11C \uB193\uAE30',
  writeOneWord: '\uB2E8\uC5B4 \uD558\uB098 \uC4F0\uAE30',
  seeObjectInFront: '\uB208\uC55E\uC758 \uBB3C\uAC74 \uD558\uB098 \uBCF4\uAE30',
  holdObject: '\uADF8 \uBB3C\uAC74\uC744 \uC190\uC5D0 \uB4E4\uAE30',
  lookAtDestination: '\uB458 \uACF3\uC744 \uBC14\uB77C\uBCF4\uAE30',
  seeTargetOnce: '\uB300\uC0C1 \uD55C \uBC88 \uBCF4\uAE30',
  moveHandClose: '\uC190\uC744 \uAC00\uAE4C\uC774 \uAC00\uC838\uAC00\uAE30',
  startTenSeconds: '10\uCD08\uB9CC \uC2DC\uC791\uD558\uAE30',
  seePlace: '\uD560 \uACF3 \uD55C \uBC88 \uBCF4\uAE30',
  nameNeededItem: '\uD544\uC694\uD55C \uAC83 \uD558\uB098 \uC774\uB984 \uC801\uAE30',
  writeNextWord: '\uB2E4\uC74C \uD560 \uB2E8\uC5B4 \uD558\uB098 \uC801\uAE30',
  breatheOnce: '\uC228 \uD55C \uBC88 \uC26C\uAE30',
};

const BASE_XP: Record<QuestGrade, number> = {
  F: 1,
  E: 3,
  D: 5,
  C: 10,
  B: 20,
  A: 40,
  S: 70,
};

const TEMPLATES: Record<QuestCategory, StepTemplate[]> = {
  study: [
    { title: TEXT.seeDeskDirection, seconds: 5, phase: 'orient' },
    { title: TEXT.sitOnChair, seconds: 10, phase: 'prepare' },
    { title: TEXT.putBookOnDesk, seconds: 15, phase: 'prepare' },
    { title: TEXT.openTodayPage, seconds: 20, phase: 'open' },
    { title: TEXT.readFirstSentence, seconds: 30, phase: 'start' },
    { title: TEXT.readOneQuestion, seconds: 45, phase: 'start' },
    { title: TEXT.startThreeMinuteTimer, seconds: 180, phase: 'continue' },
  ],
  work: [
    { title: TEXT.lookAtWorkScreen, seconds: 5, phase: 'orient' },
    { title: TEXT.openOneApp, seconds: 15, phase: 'open' },
    { title: TEXT.readTopItem, seconds: 20, phase: 'start' },
    { title: TEXT.placeCursorFirstField, seconds: 15, phase: 'prepare' },
    { title: TEXT.typeOneLine, seconds: 45, phase: 'start' },
    { title: TEXT.startThreeMinuteTimer, seconds: 180, phase: 'continue' },
  ],
  writing: [
    { title: TEXT.openWritingDoc, seconds: 10, phase: 'open' },
    { title: TEXT.putCursorInBody, seconds: 10, phase: 'prepare' },
    { title: TEXT.writeNameOrTitle, seconds: 15, phase: 'start' },
    { title: TEXT.writeOneSentence, seconds: 45, phase: 'start' },
    { title: TEXT.writeWithoutEditing, seconds: 180, phase: 'continue' },
    { title: TEXT.leaveNextSceneMemo, seconds: 60, phase: 'close' },
  ],
  cleaning: [
    { title: TEXT.lookAtFloorTile, seconds: 5, phase: 'orient' },
    { title: TEXT.pickNearestObject, seconds: 10, phase: 'prepare' },
    { title: TEXT.moveObjectToPlace, seconds: 20, phase: 'start' },
    { title: TEXT.pickOneTrash, seconds: 10, phase: 'start' },
    { title: TEXT.putInTrashCan, seconds: 15, phase: 'start' },
    { title: TEXT.startTwoMinuteTimer, seconds: 120, phase: 'continue' },
  ],
  exercise: [
    { title: TEXT.putFeetOnFloor, seconds: 5, phase: 'orient' },
    { title: TEXT.standUp, seconds: 10, phase: 'prepare' },
    { title: TEXT.rollShouldersOnce, seconds: 10, phase: 'start' },
    { title: TEXT.takeExerciseTop, seconds: 20, phase: 'prepare' },
    { title: TEXT.drinkOneSip, seconds: 15, phase: 'start' },
    { title: TEXT.startStretching, seconds: 120, phase: 'continue' },
  ],
  wake: [
    { title: TEXT.moveOneFinger, seconds: 3, phase: 'orient' },
    { title: TEXT.takeOneHandOut, seconds: 5, phase: 'prepare' },
    { title: TEXT.takeOneLegOut, seconds: 8, phase: 'prepare' },
    { title: TEXT.turnBodySide, seconds: 10, phase: 'start' },
    { title: TEXT.raiseUpperBody, seconds: 15, phase: 'start' },
    { title: TEXT.putFeetOnFloor, seconds: 10, phase: 'close' },
    { title: TEXT.drinkOneSip, seconds: 20, phase: 'close' },
  ],
  sleep: [
    { title: TEXT.seeBedDirection, seconds: 5, phase: 'orient' },
    { title: TEXT.putPhoneOnCharger, seconds: 15, phase: 'prepare' },
    { title: TEXT.turnOffOneLight, seconds: 10, phase: 'prepare' },
    { title: TEXT.sitOnBlanket, seconds: 15, phase: 'start' },
    { title: TEXT.checkAlarm, seconds: 20, phase: 'close' },
    { title: TEXT.breatheThreeTimes, seconds: 30, phase: 'close' },
  ],
  life_admin: [
    { title: TEXT.lookAtAdminItem, seconds: 5, phase: 'orient' },
    { title: TEXT.openFirstScreen, seconds: 15, phase: 'open' },
    { title: TEXT.readRequiredFieldName, seconds: 20, phase: 'start' },
    { title: TEXT.placeCursorFirstField, seconds: 10, phase: 'prepare' },
    { title: TEXT.fillOneField, seconds: 45, phase: 'start' },
    { title: TEXT.checkSaveButton, seconds: 10, phase: 'close' },
  ],
  relationship: [
    { title: TEXT.seeContactName, seconds: 5, phase: 'orient' },
    { title: TEXT.openMessageApp, seconds: 10, phase: 'open' },
    { title: TEXT.openChat, seconds: 10, phase: 'open' },
    { title: TEXT.writeFirstWord, seconds: 15, phase: 'start' },
    { title: TEXT.writeShortSentence, seconds: 45, phase: 'start' },
    { title: TEXT.readBeforeSending, seconds: 20, phase: 'close' },
  ],
};

const CATEGORY_KEYWORDS: Record<QuestCategory, string[]> = {
  study: ['\uACF5\uBD80', '\uB3C5\uC11C', '\uC2DC\uD5D8', '\uD1A0\uC775', '\uC218\uD559', '\uC601\uC5B4', '\uCC45'],
  writing: ['\uAE00', '\uC18C\uC124', '\uC6D0\uACE0', '\uC791\uC131', '\uBE14\uB85C\uADF8', '\uC77C\uAE30', '\uC4F0\uAE30'],
  cleaning: ['\uCCAD\uC18C', '\uC815\uB9AC', '\uBC29', '\uC124\uAC70\uC9C0', '\uC4F0\uB808\uAE30'],
  exercise: ['\uC6B4\uB3D9', '\uC0B0\uCC45', '\uD5EC\uC2A4', '\uC2A4\uD2B8\uB808\uCE6D', '\uC2A4\uCFFC\uD2B8'],
  wake: ['\uAE30\uC0C1', '\uC77C\uC5B4\uB098', '\uC544\uCE68', '\uCE68\uB300'],
  sleep: ['\uC7A0', '\uC218\uBA74', '\uC790\uAE30', '\uCDE8\uCE68'],
  life_admin: ['\uBA54\uC77C', '\uC11C\uB958', '\uC2E0\uCCAD', '\uC608\uC57D', '\uD589\uC815', '\uB0A9\uBD80'],
  relationship: ['\uC5F0\uB77D', '\uC804\uD654', '\uB2F5\uC7A5', '\uBA54\uC2DC\uC9C0', '\uB300\uD654'],
  work: [],
};

export function resolveQuestCategory(title: string, requested?: QuestCategory | 'auto'): QuestCategory {
  if (requested && requested !== 'auto') return requested;
  for (const category of Object.keys(CATEGORY_KEYWORDS) as QuestCategory[]) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => title.includes(keyword))) return category;
  }
  return 'work';
}

export function firstStepCapSeconds(burdenLevel: BurdenLevel, energyLevel: EnergyLevel): number {
  if (burdenLevel === 4 || energyLevel === 'low') return 10;
  if (burdenLevel === 3) return 20;
  return 30;
}

export function gradeForSeconds(seconds: number): QuestGrade {
  if (seconds <= 10) return 'F';
  if (seconds <= 30) return 'E';
  if (seconds <= 120) return 'D';
  if (seconds <= 300) return 'C';
  if (seconds <= 900) return 'B';
  if (seconds <= 1800) return 'A';
  return 'S';
}

export function difficultyForSeconds(seconds: number): number {
  if (seconds <= 30) return 1;
  if (seconds <= 120) return 2;
  if (seconds <= 300) return 3;
  return 4;
}

export function decomposeGoal(input: DecomposeGoalInput): DecomposeGoalOutput {
  const category = resolveQuestCategory(input.goalTitle, input.category);
  const cap = Math.min(
    firstStepCapSeconds(input.burdenLevel, input.energyLevel),
    obstacleFirstStepCap(input.obstacle),
    availableMinutesCap(input.availableMinutes),
  );
  const source = personalizeTemplate(TEMPLATES[category], input);
  const steps = source.map((step, index) => {
    const estimatedSeconds = index === 0 ? Math.min(step.seconds, cap) : step.seconds;
    return {
      clientId: `step-${index + 1}`,
      title: step.title,
      successCriterion: `${step.title} ${TEXT.complete}`,
      estimatedSeconds,
      phase: step.phase,
      grade: gradeForSeconds(estimatedSeconds),
    };
  });

  return {
    normalizedGoal: input.goalTitle.trim(),
    category,
    chainTitle: `${input.goalTitle.trim()} ${TEXT.entranceOpen}`,
    steps,
    recommendedFirstStepId: steps[0]?.clientId ?? '',
    message: TEXT.todayEntranceOnly,
    source: 'template',
  };
}

function obstacleFirstStepCap(obstacle?: FailureReason): number {
  if (!obstacle) return 30;
  if (['too_big', 'tired', 'anxious', 'not_now', 'forgot'].includes(obstacle)) return 5;
  return 10;
}

function availableMinutesCap(minutes?: number): number {
  if (!minutes) return 30;
  if (minutes <= 3) return 5;
  if (minutes <= 10) return 10;
  return 30;
}

function personalizeTemplate(template: StepTemplate[], input: DecomposeGoalInput): StepTemplate[] {
  const prefix: StepTemplate[] = [];
  if (input.location) {
    prefix.push({ title: `${input.location} \uBC29\uD5A5 \uBCF4\uAE30`, seconds: 5, phase: 'orient' });
  }
  if (input.obstacle === 'wrong_place') {
    prefix.push({ title: TEXT.seePlace, seconds: 5, phase: 'orient' });
  }
  if (input.obstacle === 'no_material') {
    prefix.push({ title: TEXT.nameNeededItem, seconds: 10, phase: 'prepare' });
  }
  if (input.obstacle === 'unclear') {
    prefix.push({ title: TEXT.writeNextWord, seconds: 10, phase: 'orient' });
  }
  if (input.obstacle === 'tired' || input.obstacle === 'anxious') {
    prefix.push({ title: TEXT.breatheOnce, seconds: 5, phase: 'orient' });
  }
  const titles = new Set<string>();
  return [...prefix, ...template].filter((step) => {
    if (titles.has(step.title)) return false;
    titles.add(step.title);
    return true;
  }).slice(0, 8);
}

export function shrinkStep(title: string, estimatedSeconds: number): GeneratedStep[] {
  const quick = Math.max(3, Math.min(10, Math.floor(estimatedSeconds / 3)));
  return smallerTitlesFor(title).map((replacementTitle, index) => {
    const seconds = replacementTitle === TEXT.startTenSeconds ? 10 : index === 0 ? quick : 10;
    return {
      clientId: `replacement-${index + 1}`,
      title: replacementTitle,
      successCriterion: `${replacementTitle} ${TEXT.complete}`,
      estimatedSeconds: seconds,
      phase: index === 0 ? 'orient' : 'prepare',
      grade: gradeForSeconds(seconds),
    };
  });
}

export function calculateStepReward(input: RewardInput): RewardResult {
  const base = BASE_XP[input.grade];
  const comboMultiplier = input.sessionCombo >= 5 ? 1.2 : input.sessionCombo >= 3 ? 1.1 : 1;
  const costumeMultiplier = Math.min(Math.max(input.costumeMultiplier ?? 1, 1), 1.5);
  const returnMultiplier = input.isFirstReturnStep ? 1.3 : 1;
  const xp = Math.max(1, Math.round(base * comboMultiplier * costumeMultiplier * returnMultiplier));
  return {
    xp,
    facilityXp: Math.max(1, Math.round(base * 0.8)),
  };
}

function smallerTitlesFor(title: string): string[] {
  if ([TEXT.putBookOnDesk, TEXT.openTodayPage, TEXT.readFirstSentence, TEXT.readOneQuestion].includes(title)) {
    return [TEXT.seeBookLocation, TEXT.holdBook, TEXT.putBookOnDesk, TEXT.liftCover];
  }
  if ([TEXT.openWritingDoc, TEXT.putCursorInBody, TEXT.writeOneSentence].includes(title)) {
    return [TEXT.seeDocTitle, TEXT.putCursorFirstBodyLine, TEXT.writeOneWord];
  }
  if ([TEXT.pickNearestObject, TEXT.moveObjectToPlace, TEXT.pickOneTrash, TEXT.putInTrashCan].includes(title)) {
    return [TEXT.seeObjectInFront, TEXT.holdObject, TEXT.lookAtDestination];
  }
  if ([TEXT.standUp, TEXT.startStretching, TEXT.putFeetOnFloor, TEXT.rollShouldersOnce].includes(title)) {
    return [TEXT.putFeetOnFloor, TEXT.rollShouldersOnce, TEXT.drinkOneSip];
  }
  return [TEXT.seeTargetOnce, TEXT.moveHandClose, TEXT.startTenSeconds];
}
