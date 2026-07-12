# StepQuest v0.2 Slice 6 — Fun Core 재설계

> 상태: 소유자 리뷰 대기
> 목표: 알림이나 벌점 없이도 `출발 → 기다림 → 수확 → 타격 → 다음 욕망`이 이어져 앱을 다시 열 이유를 만든다.
> 경제 불변: 타이머, 몬스터, 데미지, 대사, 도감, 미디어는 코인·골드·스텝 수·보상 캡을 바꾸지 않는다.

## 1. 문제와 성공 조건

현재 빌드에는 실제 행동을 시작하고 보고하는 기능은 있지만, 앱을 다시 열고 싶은 감정적 이유가 약하다. Slice 6는 다음 네 동기를 하나의 인과 사슬로 연결한다.

| 동기 | Slice 6의 답 |
|---|---|
| 수확 기대 | 절대 만료 시각을 가진 원정과 `수확 준비 완료` 화면 |
| 애착 | 실제로 움직이는 캐릭터와 상황을 기억하는 말풍선 |
| 타격감 | 현실 행동 → 스킬 → 피격 → 데미지 → 처치 |
| 다음 욕망 | 전투 리포트 끝과 홈에 남는 다음 행동·획득 예고 한 줄 |

자동 검증 완료만으로 Fun Core를 닫지 않는다. 배포 후 소유자가 알림 없이 서로 연속된 3개의 로컬 날짜에 자발적으로 앱을 열어야 사람 검증을 통과한다.

## 2. 범위와 명시적 제외

### 이번 슬라이스에 포함

- 5·10·25분 원정 선택, 카운트다운, 수확 준비 상태
- reward lineage마다 고정되는 몬스터 한 마리와 2칸 HP
- 움직이는 `idle`, `skill` 미디어 슬롯과 정지 `portrait`
- 기존 FX와 결합된 스킬·피격·데미지·처치 시퀀스
- version 1 결정론적 전투 리포트와 최소 몬스터 도감
- 상황 기반 말풍선과 다음 욕망 한 줄
- `#today`, `#codex` 두 화면

### 이후로 미룸

- 프로젝트 전체 보스 HP와 층 지도: Slice 7
- `hurtOrTired` 미디어 슬롯
- GIF 직접 임포트와 오디오
- 서버 업로드·동기화·푸시 알림
- 스탯, 공격력, 크리티컬, 장비 버프, 스트릭
- 과거 Slice 6 이전 원정의 도감 소급 집계

## 3. 완성된 사용자 흐름

```text
활성 스텝
  → 시간 선택과 목적지 예고
  → 출발 연출
  → 진행 중 카운트다운
  → 수확 준비 완료(시간 파생, 도메인 전이 없음)
  → 복귀 outcome 선택
  → 보고 커밋
  → skill 클립 + FX → 피격 → HP 반영
  → 전투 리포트
  → [계속]
  → 다음 스텝·Resume Anchor·막힘 라우터 중 정확한 곳
  → 다음 욕망 한 줄
```

조기 귀환도 같은 outcome 선택과 리포트 흐름을 사용한다. 문구만 `조기 귀환`이며 손실이나 보상 차이는 없다.

## 4. 원정 타이머

### 4.1 시작

- 시간 선택은 5·10·25분 라디오 그룹이며 최초 기본값은 5분이다.
- 마지막 선택은 **성공적으로 원정을 시작한 뒤에만** 로컬 profile meta에 저장한다.
- 시간은 캐릭터의 원정 길이이지 사용자의 마감이 아니다.
- 긴 시간을 선택해도 코인, 골드, 데미지, 처치 수, 도감 진행은 늘지 않는다.
- 시간 선택의 차이는 목적지 분위기뿐이다.

| 선택 | 경로 표현 | 경제·처치 영향 |
|---|---|---|
| 5분 | 캠프 외곽 | 없음 |
| 10분 | 오래된 숲길 | 없음 |
| 25분 | 깊은 유적 입구 | 없음 |

출발 전에는 `10분 · 오래된 숲길 · ???의 흔적`처럼 경로와 미발견 조우를 한 줄로 예고한다. 몬스터 이름은 발견 전 노출하지 않는다.

### 4.2 도메인 필드

신규 원정에는 다음 필드를 저장한다.

```ts
interface ExpeditionTiming {
  plannedMinutes: 5 | 10 | 25;
  expiresAt: string;
}
```

- `startStep`은 `plannedMinutes`만 입력받는다.
- 허용 값이 아니면 `EXPEDITION_DURATION_INVALID`를 반환한다.
- `expiresAt`은 도메인이 `command.now + plannedMinutes`로 계산한다. UI가 만료 시각을 전달하지 않는다.
- IndexedDB 버전은 3을 유지한다. 새 필드는 기존 레코드에서 optional이다.
- `startStep`을 rolling snapshot과 외부 자동 백업의 significant operation에 포함한다.

### 4.3 파생 상태

순수 함수 `deriveTimer(expedition, now)`는 다음 중 하나만 반환한다.

| phase | 조건 | UI |
|---|---|---|
| `running` | 유효한 `expiresAt`이 미래 | 카운트다운과 조기 귀환 버튼 |
| `ready` | 유효한 `expiresAt`이 현재 이하 | 수확 준비 완료 화면 |
| `legacy_ready` | timing 필드가 없거나 쌍이 깨짐 | 이전 버전 원정 복귀 화면 |

`ready`는 presentation 상태다. 저장된 `expedition.status`는 계속 `active`이며 시간 경과만으로 이벤트, 보상, 도감, 지갑, 백업 커밋을 만들지 않는다.

### 4.4 클록·재접속 규칙

- 카운트다운은 저장된 초를 줄이지 않고 항상 `expiresAt - Date.now()`를 재계산한다.
- 표시는 `MM:SS`, 최솟값은 `00:00`이다.
- `visibilitychange`, `pageshow`, focus, reload 때 즉시 재계산한다.
- 탭이 열린 상태에서 만료되면 active 패널만 harvest 패널로 바꾼다.
- outcome form이나 Resume Anchor 입력 중 만료돼도 화면을 빼앗거나 입력을 지우지 않는다.
- 현재 열린 세션에서 한 번 `ready`를 보여준 뒤 시스템 시계가 뒤로 가더라도 `running`으로 되돌리지 않는다.
- 다른 탭이 보고를 커밋했다면 focus 때 최신 snapshot을 다시 읽는다.
- 기존 timing 없는 원정은 데이터를 고치지 않고 `legacy_ready`로 연다.

## 5. 복귀·수확 상태 머신

정확한 순서는 다음과 같다.

1. `running`에서 `[일찍 돌아왔어요]`를 누르거나 `ready`에서 `[전리품 확인]`을 누른다.
2. 기존 outcome 4택을 보여준다. 아직 골드 액수를 약속하거나 지급하지 않는다.
3. `partial`·`interrupted`는 기존 Resume Anchor 입력을 유지한다.
4. 보고 커밋 뒤에만 실제 `goldGranted`와 피격 결과를 알 수 있다.
5. app facade는 보고 이벤트 키를 `pendingBattleReportKey` meta에 저장한다.
6. 전투 연출 후 리포트를 표시한다. 사용자가 앱을 닫아도 `[계속]` 전에는 같은 리포트를 다시 연다.
7. `[계속]`에서 pending key를 지우고 다음 상태로 이동한다.

| outcome | 처치 | HP 변화 | 계속 후 이동 |
|---|---:|---:|---|
| `completed` | 1 | 파생 HP 차이만큼 | 다음 스텝 또는 목표 완료 |
| `partial` | 0 | 최초 progress entitlement가 생겼을 때만 1 | Resume Anchor |
| `interrupted` | 0 | 0 | Resume Anchor |
| `not_started` | 0 | 0 | 막힘 라우터 |

비난, 손실, 적의 반격, 늦음 표현은 없다.

## 6. 몬스터와 데미지

### 6.1 한 lineage, 한 조우

- monster identity는 `rewardLineage`와 category로 결정한다.
- manual shrink 교체 스텝은 lineage를 승계하므로 같은 몬스터가 남는다.
- `expeditionId`는 도착 지점과 리포트 문장 변주에만 사용한다.
- 목표의 마지막 유효 lineage는 해당 category의 boss catalog를 사용한다.
- Slice 6에서는 프로젝트 전체 HP를 만들지 않는다.

### 6.2 HP 파생 규칙

각 조우의 최대 HP는 2다. 저장하지 않고 기존 상태에서 계산한다.

```text
step completed                         → HP 0
같은 lineage의 progress reward 존재    → HP 1
그 외                                  → HP 2
```

- `partial`이 처음으로 기존 progress reward를 만들면 1 데미지가 남는다.
- 같은 lineage에서 progress cap이 이미 사용됐다면 반복 partial은 경직만 표시하고 HP는 줄지 않는다.
- `completed`는 보고 직전과 직후의 HP 차이만큼 데미지를 표시하고 HP를 0으로 만든다.
- `interrupted`, `not_started`에서는 공격 애니메이션과 데미지를 재생하지 않는다.
- 데미지 숫자는 1 또는 2뿐이며 공격력·크리티컬 같은 새 수치를 암시하지 않는다.

### 6.3 카테고리와 카탈로그 v1

목표와 스텝 import 시 기존 template category를 optional 필드로 보존한다. 지원 category는 `writing`, `cleaning`, `study`, `exercise`, `wake`, `generic`이다.

| category | 일반 몬스터 예 | 보스 예 |
|---|---|---|
| writing | 잉크 슬라임, 백지 유령, 교정 까마귀 | 마감의 망령 |
| cleaning | 먼지 골렘, 얼룩 미믹, 세탁 늪괴물 | 잡동사니 왕 |
| study | 망각 박쥐, 산만 도깨비, 오답 골렘 | 시험의 파수꾼 |
| exercise | 게으름 젤리, 숨참 늑대, 무거운 갑옷게 | 철벽 트롤 |
| wake | 이불 미믹, 졸음 안개, 알람 임프 | 새벽의 몽마 |
| generic | 미루기 슬라임, 걱정 유령, 복잡함 골렘 | 막막함의 문지기 |

해시 알고리즘은 FNV-1a 32-bit, 카탈로그 버전은 `1`로 고정한다. v1 테이블의 순서와 ID는 이후 수정하지 않고 새 카탈로그는 새 version으로 추가한다.

## 7. 보고 이벤트와 전투 리포트

### 7.1 최소 불변 projection

도감과 과거 리포트를 안정적으로 재생하려면 `expedition_reported.result`에 다음 표현용 사실을 추가한다.

```ts
interface BattleProjectionV1 {
  rewardLineage: string;
  category: string;
  reportVersion: 1;
  goalMilestone: boolean;
  goldGranted: number;
}
```

이는 additive domain-event 변경이지만 보상 규칙을 바꾸지 않는다. 현재 snapshot을 추측해서 과거 리포트를 다시 만드는 것보다 안전하다.

### 7.2 리포트 구성

리포트는 세 박자로 보여준다.

1. 결과 제목: 토벌 성공·거점 확보·야영 후 귀환·정찰 기록
2. 조우 카드: 몬스터, 도달 지점, 새 발견 여부
3. 전리품: event result의 실제 `goldGranted`

골드는 지갑 차이나 outcome 표에서 추측하지 않는다. 2, 1, 0 모두 정확히 표시한다. `not_started` 문구에는 몬스터 0과 비난 없는 정찰 문장만 사용한다.

## 8. 몬스터 도감

- route는 `#codex`, 메인은 `#today`다.
- v1 report event만 집계한다. Slice 6 이전 이벤트는 소급하지 않는다.
- `completed` event 하나가 해당 encounter count를 정확히 1 증가시킨다.
- dedupe key는 report event의 idempotency key와 expedition ID다.
- `partial`, `interrupted`, `not_started`는 count를 증가시키지 않는다.
- 미발견 항목은 시각적으로 `???`, 접근성 이름은 `미발견 몬스터`다.
- 실제 이름은 발견 전 hidden DOM, alt, title, data attribute에도 넣지 않는다.
- 빈 도감은 `첫 토벌 기록이 여기에 남습니다.`를 보여준다.
- 도감 화면을 보는 동안에도 타이머는 진행하지만 만료가 강제 화면 전환을 만들지 않는다.

## 9. 움직이는 캐릭터 미디어

### 9.1 슬롯

```ts
interface CharacterMediaV1 {
  portraitKey: string;
  idleKey?: string;
  skillKey?: string;
}
```

- `portrait`: PNG·JPEG·정지 WebP. 기존 512px PNG 정규화를 유지한다.
- `idle`: 애니메이션 WebP 또는 짧은 WebM, 반복 재생.
- `skill`: 애니메이션 WebP 또는 짧은 WebM, 매 발동마다 처음부터 1회 재생.
- GIF는 v1에서 받지 않는다. 필요하면 외부에서 WebP로 변환한다.
- 기존 `imageBlobKey`는 `portraitKey`로 호환 읽기한다.
- custom portrait가 없는 상태에서는 moving slot을 저장하지 않고 `CHARACTER_PORTRAIT_REQUIRED`를 반환한다.
- DB store와 DB version은 그대로 유지한다.

### 9.2 검증과 저장

- magic bytes와 MIME을 함께 확인한다.
- moving clip 한 개 최대 6 MiB, 합계 최대 12 MiB, 최대 1024×1024다.
- WebM은 metadata duration 3초 이하만 허용한다.
- animated WebP는 RIFF frame duration 합계를 파싱해 3초 이하만 허용한다.
- WebM은 항상 muted·playsinline이며 오디오는 재생하지 않는다.
- 슬롯 교체는 새 asset 검증·저장 후 metadata swap·이전 blob 삭제를 한 transaction으로 처리한다.
- 실패하면 기존 슬롯을 그대로 보존한다.
- 모든 Object URL은 교체·render teardown에서 revoke한다.
- 일반 snapshot, service worker cache, 표준 JSON, 외부 자동 백업에는 Blob을 넣지 않는다.
- 명시적 `full-with-images` 수동 export에만 asset bytes를 넣는다.

### 9.3 모션 감소와 강등

- OS 설정 또는 앱 내 모션 감소 중 하나라도 켜지면 animated element를 DOM에 올리지 않는다.
- `portrait → 기존 정지 이미지 → built-in CSS 캐릭터` 순으로 강등한다.
- skill clip이 없거나 재생이 거절되면 기존 Slice 5 FX만 재생한다.
- reduced motion에서는 정지 portrait, 즉시 HP 갱신, 짧은 120ms·0.3 flash와 텍스트 결과만 사용한다.

### 9.4 시각 방향과 라이선스 경계

승인된 개인 참고 키프레임의 방향은 다음과 같다.

- 낮은 발도 자세, 칼집을 잡은 손, 전방 대시가 한 실루엣에서 읽힘
- 황백색 번개, 칼날의 청백색 코어, 한 방향의 참격호와 잔상
- 정면 대기 포즈나 납작한 도형 캐릭터는 사용하지 않음

개인 참고 캐릭터 파일은 앱 bundle, service worker, public repository asset으로 포함하지 않는다. 공개 배포 기본 캐릭터와 샘플은 오리지널 또는 배포 라이선스가 확인된 미디어만 사용한다. 사용자가 넣은 로컬 미디어는 서버로 전송하지 않는다.

## 10. 스킬·피격 시퀀스

`completed`의 순서는 고정한다.

```text
skill clip 시작
  + 기존 FX 중첩
  → 몬스터 hit reaction
  → 실제 파생 HP 차이의 데미지 숫자
  → HP bar 갱신
  → HP 0이면 fade + fall 처치
  → 전투 리포트
```

- clip과 FX는 사용자가 skip할 수 있다.
- skip은 결과를 건너뛰지 않고 마지막 시각 상태와 리포트로 즉시 이동한다.
- `partial`에서 새 progress entitlement로 HP가 1 줄었다면 같은 skill·hit 시퀀스를 짧게 재생하되 처치 연출은 하지 않는다.
- 반복 partial처럼 HP 차이가 0이면 몬스터의 중립적인 방어 반응만 보여주고 가짜 데미지 숫자를 만들지 않는다.
- `interrupted`, `not_started`에서는 skill·hit·damage를 재생하지 않는다.
- HP bar는 `role="progressbar"`, 이름, 현재값, 최댓값을 가진다.
- 데미지는 색이나 애니메이션만으로 전달하지 않고 live text에도 기록한다.

## 11. 말풍선

대사는 render 횟수가 아니라 semantic trigger마다 한 번 선택한다. 선택 키는 `context + relevant entity id + local date`이며 한 context에서 직전 문장을 즉시 반복하지 않는다.

우선순위는 다음과 같다.

1. pending 전투 리포트
2. 수확 준비 완료
3. 조기 귀환 outcome form
4. 원정 출발
5. blocked·waiting·deferred
6. 48시간 이상 공백 후 복귀
7. 로컬 날짜의 첫 실행
8. 평상시

문장은 실제 step title, monster display name, Resume Anchor의 next action, camp 변화 중 하나를 포함한다. 카운트다운 tick, form rerender, hash navigation은 대사를 바꾸지 않는다.

어떤 문장도 늦음, 실패, 실망, 연속 접속, 결석을 평가하지 않는다. `not_started` 뒤에는 적이 기다리고 있다는 중립 문장만 사용한다.

## 12. 다음 욕망 한 줄

홈과 전투 리포트 마지막에 정확히 하나만 표시한다. 목록을 만들지 않는다.

우선순위는 다음과 같다.

1. 캠프 확장 비용이 이미 있으면 `캠프를 지금 확장할 수 있어요.`
2. 현재 lineage의 몬스터가 미발견이면 `“현재 스텝” 완료 → ??? 발견`
3. 캠프가 최대 미만이면 `다음 캠프까지 골드 N`
4. 활성 목표가 있으면 `다음 마일스톤: “스텝 제목”`
5. 모두 끝났으면 `새 목표가 다음 조우를 엽니다.`

도감 이름은 발견 전에 노출하지 않는다. 다음 욕망은 버튼 목록이 아니라 현실의 다음 행동과 예상되는 표현 보상을 연결하는 exit hook이다.

## 13. 접근성·오류 처리

- 초 단위 countdown은 assertive live region에 넣지 않는다. `ready` 전환만 한 번 알린다.
- 시간 선택과 navigation은 모바일 44px target을 유지한다.
- 사용자 전환 뒤에는 새 heading 또는 primary action으로 focus를 이동한다.
- background timer가 throttle돼도 절대 시각 재계산으로 복구한다.
- 미디어 decode 실패, quota 부족, autoplay 거절은 기존 portrait·FX로 강등하며 원정과 보고를 막지 않는다.
- 카탈로그 join이 불가능한 레코드는 generic category의 중립 리포트로 표시하되 도감 count에서는 제외한다.

## 14. 저장·백업·PWA

- IndexedDB version은 3을 유지한다.
- timing, category, report projection은 기존 store 레코드의 additive 필드다.
- last duration, pending report, dialogue cursor는 meta이며 경제 snapshot에 포함하지 않는다.
- active expedition 시작도 significant backup으로 취급한다.
- 새 presentation module을 `stepquest-v02-fun.js`로 분리한다.
- 변경된 HTML, CSS, domain, storage, app, UI, fun module의 build key를 모두 `v02-core-5`로 맞춘다.
- service worker cache name도 올리고 정확한 URL을 static test로 고정한다.
- 사용자 미디어 Blob은 SW cache에 들어가지 않는다.

## 15. 컴포넌트 경계

| 컴포넌트 | 책임 |
|---|---|
| Domain | duration 검증·expiresAt 계산, category 보존, immutable report projection, 기존 보상 |
| Fun | timer 파생, FNV hash, encounter, HP, report, codex, dialogue, desire 순수 함수 |
| Storage | additive 필드 왕복, media slot transaction, meta |
| App facade | 선택 시간 전달, pending report·backup 조정, snapshot 갱신 |
| UI | state machine 화면, timer lifecycle, media playback, navigation, focus |
| FX | 기존 effect primitive와 skip lifecycle 유지 |

Fun module은 지갑을 쓰거나 repository command를 실행하지 않는다. UI의 clock tick도 command를 실행하지 않는다.

## 16. 자동 검증

### 순수·도메인

- 허용 duration 저장, invalid duration 거절, expiresAt 계산
- timing 필드 저장·복원·fallback·JSON export
- 30일 경과 뒤에도 이벤트·보상·지갑·status 불변
- FNV와 encounter/report 결과 결정론, catalog version 고정
- manual shrink 뒤에도 동일 rewardLineage 몬스터
- HP 2→1→0, 반복 partial 추가 감소 없음
- `goldGranted` 2·1·0 정확히 서술
- completed만 도감 +1, duplicate·reload +0
- time, damage, codex가 reward rows와 wallet에 0 영향
- media slot atomic replace, invalid replace 보존, Blob 일반 백업 제외

### E2E

- 최초 5분, 직전 선택 복원, 출발 뒤에만 preference 저장
- countdown → clock advance → ready, command·reward 0건
- unexpired reload는 countdown, expired reload는 harvest, legacy는 legacy-ready
- outcome form을 연 채 만료돼도 draft와 focus 유지
- 조기 귀환·늦은 귀환 보상 동일
- report commit → skill/FX/hit/damage/HP → 리포트
- 리포트 전 reload → 같은 pending report
- 실제 gold와 리포트 숫자 일치
- 도감 hash route·unknown 비노출·count 증가
- 다음 욕망 모든 fallback에서 정확히 1개
- animated WebP·WebM 재생과 portrait 강등
- OS·앱 모션 감소에서 animated media 미마운트
- 기존 obstacle, Resume Anchor, camp, Slice 5 FX 회귀 없음

### 사람 검증

관찰 기간에는 알림과 리마인더를 끈다. 같은 owner profile에서 서로 연속된 로컬 날짜 3일 동안 하루 첫 foreground session만 센다. 소유자가 `해야 해서`가 아니라 `원정 결과가 궁금해서` 열었는지 직접 기록한다.

실패하면 무조건 대사 수를 늘리지 않는다.

| 끊긴 지점 | 다음 가설 |
|---|---|
| 타이머를 시작하지 않음 | 출발 예고·시간 선택이 매력 없음 |
| ready여도 돌아오지 않음 | 수확 기대가 약하거나 시간이 맞지 않음 |
| 열었지만 보고하지 않음 | harvest 화면·outcome 입력 마찰 |
| 보고 후 다음 원정을 안 함 | 리포트·다음 욕망의 exit hook 약함 |
| 연출을 자주 skip | 연출이 길거나 반복적임 |

## 17. 완료 기준

- 위 자동 검증이 모두 통과한다.
- PWA 재방문에서 `v02-core-5`가 적용된다.
- 기존 v2/v3 진행 기록과 캐릭터 portrait가 보존된다.
- 시간 경과만으로 도메인·경제가 변하지 않는다.
- 실제 행동 이후에만 HP·처치·도감이 전진한다.
- 개인 참고 미디어가 배포 산출물에 포함되지 않는다.
- 소유자 사람 검증을 통과하기 전에는 Fun Core 상태를 `검증 중`으로 유지한다.
