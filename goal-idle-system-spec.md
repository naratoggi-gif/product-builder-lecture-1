# Goal Idle System Spec (MVP+)

## 1) Product Intent

이 서비스의 핵심 차별점은 "게임 캐릭터가 곧 나"라는 정체성이다.
방치형 성장은 접속 동기를 만들고, 목표 실행 시스템은 실제 삶의 행동 변화를 만든다.

핵심 원칙:
- 작은 실행을 큰 목표보다 우선 보상한다.
- 실패를 처벌하지 않고 즉시 축소 재도전으로 연결한다.
- 코스튬은 단순 스킨이 아니라 행동 기반 정체성 보상이다.

---

## 2) Core Loop

1. 유저 접속 -> 오프라인 방치 보상 수령(`idle_gold`)
2. 방치 재화로 일반 성장(레벨, 일반 스킬, 장비)
3. 오늘 목표의 "즉시 행동(2분 이하)" 실행
4. 즉시 행동/주간 미션 완료 시 `goal_coin` 획득
5. `goal_coin + 행동 업적`으로 코스튬 해금
6. 코스튬 장착 시 외형 + 전용 스킬셋 전환
7. 더 강해진 상태로 방치 루프 재진입

---

## 3) Goal Architecture (3 Layers)

모든 목표는 아래 3계층으로 저장한다.

1. Vision Goal (거시 목표)
- 예: "3개월간 체지방 5% 감량"
- 기간: 4주 이상
- 직접 보상보다 방향성 제공 역할

2. Weekly Mission (중간 목표)
- 예: "이번 주 4회 운동"
- 기간: 7일
- Vision 진행률에 직접 반영

3. Micro Action (즉시 행동)
- 예: "운동복 입기", "물 1잔 마시기", "의자에서 일어나기"
- 권장 수행시간: 10초~2분
- 실제 실행 및 보상의 기본 단위

규칙:
- Weekly Mission 생성 시 Micro Action 최소 3개 강제
- Vision Goal은 Weekly Mission 최소 2개 이상 연결
- 당일 첫 화면 CTA는 "지금 가능한 가장 작은 행동 1개"만 노출

---

## 4) Persistence & Success Systems

### 4.1 Persistence (지속성)
- 스트릭 유지 조건: 하루 1개 이상 Micro 완료
- 스트릭 끊김 방지: 주 1회 `streak_recover_token` 자동 지급
- 최근 14일 실행률 기반 `consistency_score` 계산

Consistency Score:
- `execution_rate_14d = completed_micro_14d / planned_micro_14d`
- `streak_factor = min(current_streak_days / 14, 1.0)`
- `consistency_score = round(execution_rate_14d * 70 + streak_factor * 30)`

### 4.2 Success (목표 성공 가능성)
목표 생성 시 성공 예측 점수를 계산한다.

Success Prediction Score (0-100):
- 입력:
  - 목표 소요시간(분)
  - 목표 난이도(1-5)
  - 동일 유형 과거 성공률
  - 예정 시간대의 과거 실행률
  - 사용자 피로 지표(자기기입)
- 계산 예:
  - `base = 100`
  - `time_penalty = min(duration_min * 0.6, 30)`
  - `difficulty_penalty = (difficulty - 1) * 8`
  - `history_bonus = historical_success_rate * 20` (0.0~1.0)
  - `timeslot_bonus = timeslot_success_rate * 10` (0.0~1.0)
  - `fatigue_penalty = fatigue_level * 5` (0~5)
  - `score = clamp(base - time_penalty - difficulty_penalty - fatigue_penalty + history_bonus + timeslot_bonus, 0, 100)`

권장 UX:
- 70 이상: 그대로 진행
- 40~69: 목표 축소 제안 표시
- 39 이하: 축소안을 기본 선택으로 강제 제안

### 4.3 Adaptive Downscaling (축소 재도전)
실패 시 즉시 아래 순서로 축소:
1. 소요시간 50% 축소
2. 행동 단계를 1단계만 남김
3. "10~30초 행동" 템플릿으로 교체

예:
- "헬스 1시간" 실패 ->
- "운동복 입고 문 앞 1분 서있기" 제안

---

## 5) Currency & Reward Design

통화:
- `idle_gold`: 방치 전투 전용 재화
- `goal_coin`: 목표 실행 전용 프리미엄 재화

보상 원칙:
- 큰 목표 1회 달성보다 작은 행동의 연속성에 총 보상이 높아야 한다.

Reward Example:
- Micro 완료: +2 goal_coin
- 하루 3개 Micro 완료: +5 bonus
- 7일 스트릭 달성: +20 bonus
- Weekly Mission 완료: +25
- Vision Goal 완료: +80 + 타이틀 배지

일일 상한:
- `daily_goal_coin_cap = 120`

---

## 6) Costume System (Differentiation)

코스튬 구매 조건:
- `goal_coin` 비용 + 행동 업적 조건 동시 충족

예시:
- `Iron Vanguard`: goal_coin 500 + 아침 루틴 14일
- `Abyss Scholar`: goal_coin 800 + 집중 세션 20회

장착 효과:
- 외형 스프라이트 변경
- 전용 스킬셋 전환
- 프로필 칭호/오라 변경

밸런스 원칙:
- 기본 스탯 성장은 일반 성장값 유지
- 코스튬은 전투 스타일/메커닉 변화 중심
- P2W 방지를 위해 코스튬 수치 파워는 제한하고 유틸/플레이감 차별을 강화

IP 정책:
- 상용 MVP에서는 오리지널 코스튬만 사용
- 외부 IP 캐릭터는 정식 라이선스 계약 후 제공

---

## 7) Data Model (SQL-Oriented)

### 7.1 Existing Core
- `users(id, email, nickname, created_at)`
- `player_profiles(user_id, job, level, exp, atk, hp, last_login_at, last_idle_claim_at)`
- `currencies(user_id, idle_gold, goal_coin, updated_at)`

### 7.2 Goal Decomposition
- `vision_goals`
  - `id (pk)`
  - `user_id (fk)`
  - `title`
  - `description`
  - `target_date`
  - `status` (OPEN, DONE, ARCHIVED)
  - `created_at`
  - `completed_at`

- `weekly_missions`
  - `id (pk)`
  - `vision_goal_id (fk)`
  - `user_id (fk)`
  - `title`
  - `week_start_date`
  - `week_end_date`
  - `target_count`
  - `completed_count`
  - `status` (OPEN, DONE, EXPIRED)
  - `created_at`
  - `completed_at`

- `micro_actions`
  - `id (pk)`
  - `weekly_mission_id (fk)`
  - `user_id (fk)`
  - `title`
  - `estimated_seconds`
  - `difficulty` (1~5)
  - `scheduled_at`
  - `status` (OPEN, DONE, SKIPPED, FAILED)
  - `created_at`
  - `completed_at`

### 7.3 Execution & Persistence
- `micro_action_logs`
  - `id (pk)`
  - `micro_action_id (fk)`
  - `user_id (fk)`
  - `result` (DONE, FAILED, SKIPPED)
  - `executed_at`
  - `memo`

- `consistency_states`
  - `user_id (pk/fk)`
  - `current_streak_days`
  - `best_streak_days`
  - `execution_rate_14d`
  - `consistency_score`
  - `streak_recover_tokens`
  - `last_streak_updated_at`

### 7.4 Success Prediction
- `goal_prediction_snapshots`
  - `id (pk)`
  - `user_id (fk)`
  - `goal_type` (WEEKLY, MICRO)
  - `target_id`
  - `score`
  - `duration_min`
  - `difficulty`
  - `historical_success_rate`
  - `timeslot_success_rate`
  - `fatigue_level`
  - `suggested_downscale_json`
  - `created_at`

### 7.5 Costume Conditions
- `costumes`
  - `id (pk)`
  - `name`
  - `price_goal_coin`
  - `sprite_set_id`
  - `skillset_id`
  - `rarity`
  - `active`

- `costume_requirements`
  - `id (pk)`
  - `costume_id (fk)`
  - `requirement_type` (STREAK_DAYS, ROUTINE_COUNT, WEEKLY_CLEAR_COUNT, VISION_CLEAR_COUNT)
  - `operator` (GTE, EQ)
  - `target_value`

- `user_costumes`
  - `user_id (fk)`
  - `costume_id (fk)`
  - `owned_at`
  - `is_equipped`

---

## 8) API Design (MVP+)

### Goal Creation & Breakdown
- `POST /goals/vision`
  - Vision 생성

- `POST /goals/vision/{id}/weekly-plan`
  - 주간 미션 자동 생성

- `POST /goals/weekly/{id}/micro-generate`
  - Micro Action 자동 분해 생성

### Execution
- `GET /actions/next-micro`
  - "지금 할 가장 작은 행동 1개" 반환

- `POST /actions/micro/{id}/complete`
  - Micro 완료 처리 + goal_coin 지급

- `POST /actions/micro/{id}/fail`
  - 실패 기록 + 축소 재도전 제안 반환

### Persistence
- `GET /consistency/me`
  - 스트릭/점수/복구토큰 조회

- `POST /consistency/recover`
  - 복구토큰 사용해 스트릭 복구

### Prediction
- `POST /prediction/score`
  - 성공 예측 점수 계산

### Economy & Costume
- `POST /idle/claim`
  - 오프라인 방치 보상 수령

- `GET /shop/costumes`
  - 코스튬 목록 + 해금조건 달성여부

- `POST /shop/costumes/{id}/buy`
  - 구매 (goal_coin + requirement check)

- `POST /costumes/{id}/equip`
  - 장착 (외형 + 스킬셋 전환)

---

## 9) Pseudocode

### 9.1 Micro Completion
```txt
if micro.status != OPEN: reject
if daily_goal_coin_earned >= daily_goal_coin_cap: coin_reward = 0 else coin_reward = 2

mark micro as DONE
insert micro_action_log(DONE)
increment weekly.completed_count
add currencies.goal_coin += coin_reward

if completed_micro_today_count == 3: add +5
if streak reaches 7: add +20

recalculate consistency_state
```

### 9.2 Failure -> Downscale
```txt
mark micro as FAILED
insert micro_action_log(FAILED)

downscaled = generate_downscale(micro):
  duration = max(10 sec, floor(original_duration * 0.5))
  simplify title to 1-step action
  if still high difficulty: fallback template "stand up now"

return downscaled suggestion
```

### 9.3 Costume Purchase
```txt
if user.goal_coin < costume.price_goal_coin: reject
if not all requirements satisfied: reject
if already owned: reject

deduct goal_coin
insert user_costume
```

---

## 10) UX Requirements

- 홈 최상단: "지금 실행 버튼(2분 이하)" 고정
- 실패 시 모달: "실패"가 아니라 "난이도 낮춰 계속하기" 문구
- 진행 시각화:
  - 오늘 실행률
  - 14일 지속성 점수
  - 스트릭/복구토큰
- 코스튬 상점:
  - 가격과 함께 행동 업적 조건을 체크리스트로 표시

---

## 11) Metrics & Experiments

KPI:
- D1/D7 잔존율
- 일간 Micro 실행 수
- 스트릭 7일 도달률
- 실패 후 10분 내 재시도율
- 코스튬 첫 구매까지 걸린 평균 일수

A/B 실험:
- A: 일반 TODO형 UI
- B: "지금 가능한 1개 행동" 강제 UI
- 성공 기준: D7, 실행률, 실패 후 이탈률 개선

---

## 12) Build Priority (4 Weeks)

1주차:
- Goal 3계층 CRUD
- Micro 완료/실패/로그
- 기본 보상 지급

2주차:
- 스트릭/복구토큰/지속성 점수
- 성공 예측 점수 API
- 축소 재도전 제안 로직

3주차:
- 코스튬 구매 조건(코인+업적) 검사
- 장착 시 스킬셋 전환
- 상점/홈 핵심 UI

4주차:
- 밸런싱
- KPI 대시보드
- A/B 실험 토글
