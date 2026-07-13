# StepQuest v0.2 Core 6 — Private Media and PWA Update Design

> 상태: 사용자 승인 · 구현 준비
> 목표: 개선한 v2 키아트를 실제 private 캐릭터 미디어로 사용하고, 설치 PWA가 새 앱 셸을 받았는데도 이전 문서를 계속 보여주는 업데이트 공백을 제거한다.

## 1. 확인된 문제

두 문제는 서로 독립적이다.

1. `zenitsu_skill_thunderclap_v2.png`는 기존 `zenitsu_idle.webp`와 `zenitsu_skill_thunderclap.webp`보다 약 5분 뒤 별도로 생성된 1254×1254 키아트다. 기존 WebP 생성 스크립트는 v2를 참조하지 않으며 구형 단순 SVG 캐릭터만 렌더한다. 따라서 기존 WebP를 안내하면 사용자는 반드시 구형 저품질 원화를 보게 된다.
2. 공개 배포의 `/goals`, `/sw.js`, CSS, Fun/Media 모듈은 merge commit과 일치한다. 그러나 기존 core-4 문서가 열린 상태에서 core-5 서비스 워커가 `skipWaiting()`과 `clients.claim()`을 완료해도 실행 중인 HTML과 JavaScript는 교체되지 않는다. 재현에서 controller와 cache는 core-5로 바뀌었지만 `도감`과 dialogue DOM은 reload 전까지 0개였다.

## 2. 범위

### 포함

- v2 키아트를 identity/style anchor로 사용하는 private portrait, idle, skill 미디어
- 기존 구형 canonical 파일의 비파괴 `_legacy` 보관
- PWA build `v02-core-6`
- 새 service worker controller 감지 후 같은 build에서 최대 1회 reload
- foreground 복귀 때 service worker update 확인
- 모든 v0.2 화면에 보이는 build 표식
- v0.2 mount 실패 시 구형 화면으로 조용히 남지 않는 오류 패널
- old-document → new-controller → reload 회귀 테스트

### 제외

- private 캐릭터 파일의 앱 번들·service worker cache·Git 추적
- 서버 업로드나 계정 동기화
- reward, HP, Codex, timer 또는 DB schema 변경
- GIF 지원

## 3. Private 미디어 설계

### 3.1 계보와 보관

private 폴더는 `assets/sample-character-zenitsu/`를 유지한다. 기존 파일은 최초 수정 전에 다음 이름으로 복사해 보존한다.

- `zenitsu_portrait_legacy.png`
- `zenitsu_idle_legacy.webp`
- `zenitsu_skill_thunderclap_legacy.webp`

새 canonical 파일은 기존 OneDrive 선택 경로를 유지한다.

- `zenitsu_portrait.png`
- `zenitsu_idle.webp`
- `zenitsu_skill_thunderclap.webp` — cross-browser/iPhone/Safari phone 권장 import
- `zenitsu_skill_thunderclap.webm` — compact Chromium/Android용 선택 import

이 폴더는 공개 저장소에 추가하지 않는다.

### 3.2 시각 계약

`zenitsu_skill_thunderclap_v2.png`는 skill의 identity, 얼굴, 머리, 의상, 검, 낮은 발도 자세, 황금·청백 번개, 어두운 배경을 고정하는 edit target이다.

- portrait: v2와 같은 고세부 치비 디자인의 차분한 준비 자세. 정면 또는 3/4 전신, 검은 칼집을 잡고 황금 스파크가 약하게 남는다.
- idle: portrait key art를 기반으로 호흡, 2–4px 부유, 옷자락, 눈 깜빡임 또는 약한 스파크만 움직인다. 공격 동작을 반복하지 않는다.
- skill: 기존 v2 공격 이미지를 핵심 프레임으로 보존한다. `응축 → 황금 섬광 → 낮은 발도 대시 → 청백 검광과 황금 참격호 → 잔상 소멸`의 순서로 연출한다.

텍스트, 워터마크, 추가 인물, 로고는 넣지 않는다.

### 3.3 기술 계약

- portrait: 512×512 PNG
- idle: animated WebP, 512×512 또는 768×768, 8–12 frames, 1.2–1.8s, infinite loop
- skill WebP/WebM: 512×512 또는 768×768, 8–12 beats, 0.9–1.5s, no audio, non-loop playback semantics
- 각 moving 파일 ≤ 6,291,456 bytes
- idle + 선택한 skill 합계 ≤ 12,582,912 bytes
- 각 변 ≤ 1024px, duration ≤ 3000ms
- magic bytes, MIME, 실제 browser decode, dimensions, duration을 importer와 동일한 검사기로 확인한다.

고세부 불투명 skill은 두 형식 모두 제공한다. 교차 브라우저와 iPhone/Safari phone import에는 `zenitsu_skill_thunderclap.webp`를 우선 권장하고, `zenitsu_skill_thunderclap.webm`은 compact Chromium/Android용 선택 import로 유지한다. 실제 app inspector에서 Chromium은 portrait PNG, idle WebP, skill WebP, VP8 WebM을 모두 통과했지만 Playwright WebKit은 portrait PNG, idle WebP, skill WebP만 통과했고 VP8 WebM은 `CHARACTER_MEDIA_DECODE_FAILED`로 실패했다.

## 4. PWA 업데이트 설계

### 4.1 경계

새 `stepquest-pwa-update.js`는 service worker 등록과 페이지 reload lifecycle만 담당한다. Domain, storage, UI 상태를 읽거나 쓰지 않는다.

```js
StepQuestPwaUpdate.mount({
  build: 'v02-core-6',
  navigatorValue: navigator,
  locationValue: location,
  sessionStorageValue: sessionStorage,
  windowValue: window,
  documentValue: document,
});
```

### 4.2 동작

1. `load`에서 `/sw.js`를 `updateViaCache: 'none'`으로 등록한다.
2. `pageshow`, window `focus`, hidden→visible에서 중복 호출 없이 `registration.update()`를 실행한다.
3. mount 시 이미 controller가 있던 문서에서 `controllerchange`를 받으면 `stepquest:pwa-reloaded:v02-core-6` session guard를 확인한다.
4. controller가 없던 최초 설치의 첫 claim은 reload하지 않고 이후 controller 교체부터 갱신 대상으로 본다.
5. 같은 build에서 reload하지 않았다면 guard를 먼저 기록한 뒤 `location.reload()`를 정확히 1회 호출한다.
6. 이미 guard가 있으면 reload loop를 만들지 않는다.

현재 실행 중인 core-5 문서에는 이 listener가 없으므로 이번 전환에 한해 사용자가 앱 전환기에서 PWA를 완전히 종료하고 다시 여는 동작은 한 번 필요하다. core-6 이후 전환은 자동 처리한다.

### 4.3 가시성·오류

- `오늘 / 도감` navigation 근처에 `Fun Core · v02-core-6` 표식을 항상 렌더한다.
- `StepQuestV02UI.mount()`는 try/catch로 감싼다.
- mount 실패 시 legacy 화면을 그대로 두지 않고 build, 중립 오류 문구, `[새 버전 다시 열기]` 버튼을 보여준다.
- 오류 패널은 사용자의 DB나 wallet을 바꾸지 않는다.

## 5. Cache와 shell

- HTML, CSS, domain, storage, backup, character, media, fun, fx, app, UI, PWA update module의 query build를 `v02-core-6`으로 맞춘다.
- service worker cache name도 `v02-core-6`으로 올린다.
- 새 PWA update module을 APP_SHELL에 정확히 한 번 추가한다.
- private 캐릭터 파일과 E2E fixture는 APP_SHELL에 넣지 않는다.

## 6. 검증

### 순수·정적

- 기존 controller의 controllerchange에서 reload 1회, 동일 build 반복 0회, 최초 설치 claim reload 0회
- pageshow/focus/visible update coalescing
- registration/update/reload 실패가 앱 mount를 막지 않음
- HTML/SW의 core-6 URL 완전 일치
- private asset 이름과 폴더가 HTML/SW/Git 추적 파일에 없음

### E2E

- old document가 새 controller를 받아도 DOM은 바뀌지 않는 RED 재현
- hotfix 후 controllerchange → reload → `오늘 / 도감`, build 표식, Fun/Media module 확인
- mount 강제 실패 → legacy 화면 대신 오류 패널과 reload 버튼
- 기존 owner journey, media import, reduced motion, v3 legacy fixture 회귀

### Asset

- portrait·idle·skill 대표 프레임 육안 검토
- idle first/last loop 이음새
- skill에 v2의 낮은 발도 자세와 검광이 실제로 보임
- app media inspector에서 Chromium은 portrait PNG·idle WebP·skill WebP·VP8 WebM 통과
- Playwright WebKit은 portrait PNG·idle WebP·skill WebP 통과, VP8 WebM은 `CHARACTER_MEDIA_DECODE_FAILED` 확인
- canonical 파일이 legacy SVG frame과 픽셀 계보가 다름

## 7. 완료 기준

- 새 private canonical 파일이 v2 시각 계보를 사용한다.
- 공개 앱을 열면 모든 상태에서 `Fun Core · v02-core-6`이 보인다.
- 새 controller 전환은 같은 build에서 reload를 정확히 한 번만 일으킨다.
- mount 실패가 “아무것도 달라지지 않은 구형 화면”으로 위장되지 않는다.
- reward·HP·Codex·timer·DB schema diff가 없다.
- CI와 mobile Safari 반복 검증이 통과한다.
- 배포 공개 HTML과 SW에서 core-6가 확인된다.
- private 캐릭터 파일은 배포 산출물에 포함되지 않는다.
