# StepQuest v0.2 Slice 5 — Character Import & Skill FX

## 1. Purpose

Give the static character a presence: user-imported art, skill effect presets, and technique-name cut-ins. Designed in three phases so the same effect engine survives from personal use through distribution to commercial production. The effect engine is IP-agnostic — art gets swapped, code does not.

Independent of Slices 2–4, but the camp (Slice 4) supplies the stage where the character stands.

## 2. Phase A — Personal build (this slice's implementation scope)

### 2.1 Character asset

The user registers one image (PNG/WebP/JPG, client-side downscaled to max 512px, stored as a Blob).

```ts
interface CharacterAsset {
  id: string;
  name: string;                 // "사이타마"
  imageBlobKey: string;         // assets store key
  skillPreset: "impact" | "dash" | "slash" | "cast";
  skillName: string;            // cut-in text, e.g. "벽력일섬"
  accentColor: string;          // one of 8 fixed palette choices, not free hex
  createdAt: string;
}
```

Storage: new IndexedDB object store `assets` (Blobs) plus `characters` (metadata). This REQUIRES a DB version bump to 3 — additive `onupgradeneeded` only, no data migration. The localStorage fallback repository stores no Blobs; it falls back to the default built-in character and says so calmly.

Backup: JSON export includes `characters` metadata but NEVER image Blobs (a 512px image would bloat every rolling snapshot). The external-file auto backup likewise excludes Blobs. Settings offers a separate one-time "이미지 포함 전체 내보내기" that writes a `.zip`-less sidecar JSON with base64 images, clearly labeled as manual-only.

### 2.2 Effect engine — 6 primitives, no character animation

All effects are layers composited around the static image. Module `stepquest-v02-fx.js`, DOM/WAAPI only, zero dependencies, ~200 lines:

1. `flash(intensity, ms)` — full-stage white overlay
2. `shake(px, ms)` — stage container jitter
3. `afterimage(count)` — clone the character element 2–3× with decaying opacity along a motion path
4. `shockring(x, y, color)` — expanding SVG circle
5. `bolt(from, to, color)` / `arc(path, color)` — SVG polyline lightning or slash arc
6. `cutin(text, color)` — technique-name overlay, large type, letter-spaced

Presets compose primitives:

- `impact` (원펀치형): dash-in → flash 0.85 → shockring → shake → speed lines
- `dash` (벽력일섬형): pre-flash → bolts → afterimages + fast translate → shockring
- `slash` (참격형): leap → stroke-drawn arc → flash → shake
- `cast` (마법형): hover bob → dashed summoning circle → ring + flash

### 2.3 Integration points and rules

- Plays on: expedition departure (short, ≤600ms), `completed` outcome (full, ≤1.2s), Goal milestone (full + cut-in).
- Never plays on: `not_started`, `interrupted`, parked/blocked transitions — effects celebrate action, never punctuate a stop.
- Every play is skippable by tap. `prefers-reduced-motion` reduces every preset to cut-in text + single 120ms flash at 0.3.
- Effects are fire-and-forget: domain state renders immediately (v0.2 rule "상태·다음 행동 즉시, 연출 비동기"), the effect layers over the already-updated screen.

### 2.4 Copyright posture (Phase A)

Imported images are user-local content: stored only in the user's browser, never uploaded, never bundled, never shown to anyone else. The import screen carries one line: "가져온 이미지는 이 기기에만 저장되며 개인 사용 범위에서만 쓰세요." This is a product-behavior guarantee, not legal advice.

### 2.5 Phase A resolution details

- `local-primary` is the only persisted character ID. Importing again replaces its metadata and Blob; Phase A has no roster, deletion, sharing, or cloud path.
- `skillPreset` is the one preset used by real loop triggers. The settings panel exposes four preview buttons so the same saved image can demonstrate all presets without rotating or randomizing live behavior.
- The built-in fallback is the existing code-drawn/CSS silhouette. It is not a persisted `CharacterAsset` and introduces no third-party image or bundled copyrighted asset.
- The 512px limit applies to the image's longest edge. The browser redraws accepted PNG/WebP/JPG input to PNG so SVG and untrusted embedded content never enter storage. Invalid or undecodable input leaves the previous character unchanged.
- IndexedDB stores the PNG as a Blob when the engine supports it. If an engine rejects Blob/File values in IndexedDB, the repository stores the same local bytes as an ArrayBuffer and reconstructs a Blob at its public boundary; no image bytes enter localStorage or ordinary backups.
- Character and technique names are trimmed, escaped at render time, and limited to 40 characters. Empty values use `나의 모험가` and `첫걸음`. Accent color is selected from the eight constants owned by `stepquest-v02-character.js`; arbitrary colors are rejected.
- `partial` has no FX. A final-step `completed` event plays one milestone variant, not a completed animation followed by a second animation.
- Speed lines, dash translation, leap/hover transforms, and the summoning circle are private preset helpers composed around the six named public primitives.
- The FX overlay owns pointer input while active and exposes a visible `연출 건너뛰기` control. Tap, Escape, Enter, or Space cancels it without activating controls underneath.
- Reduced motion is enabled when either `prefers-reduced-motion: reduce` or the existing in-app reduced-motion setting is true. It always uses only the cut-in plus a 120ms flash at intensity 0.3.
- Ordinary JSON, rolling snapshots, and automatic external backups include character metadata but no image bytes, data URL, or base64. A missing Blob always renders the built-in fallback with a calm local-image notice.
- The one-time `이미지 포함 전체 내보내기` produces schema-version-3 JSON containing the normal export plus an `assets` array with base64. Importing that file is outside Phase A.
- Phase B begins only when the owner intentionally shares the app with another person. A technically public deployment used solely by the owner does not by itself add Phase B art scope.

## 3. Phase B — Distribution-ready (design only, do not build yet)

Trigger: the moment the app is shared with even one other person.

- Ship 3–5 ORIGINAL default characters (commissioned or self-made) covering the four presets. The default experience must be complete without any import.
- User import remains, unchanged, as local-only UGC. No gallery, no sharing, no cloud sync of image Blobs — absence of distribution features is the compliance strategy.
- If cloud sync ever syncs characters, it syncs metadata only; Blobs stay device-local.
- All marketing/store screenshots use original characters only.
- Rename nothing: `CharacterAsset` already abstracts the art source, so original characters are just pre-seeded rows pointing at bundled files instead of user Blobs.

## 4. Phase C — Commercial (roadmap, cost-honest)

Trigger: paid distribution or any monetization.

### 4.1 Real animated skills, in cost order

1. **Paper-doll rigging**: cut each original character into 3–5 parts (body, arm, head, weapon), CSS/WAAPI rotation around anchor points. One-time cut per character, reuses the Phase A engine for everything else. This is the recommended first step — it makes the character visibly "swing" during `slash`/`impact` at ~1 day of art per character.
2. **Sprite sheets**: 6–12 frames per skill per character for hero moments (milestone celebration only, not every step). Budget roughly one animator-day per skill.
3. **Skeletal animation (Spine/DragonBones)**: full smooth motion. Only worth it after revenue exists; also enables costume swapping on one rig.

Keep the trigger architecture identical across all three: `fx.play(preset, characterId)` looks up the character's animation tier and degrades gracefully (skeletal → sprite → paper-doll → static+layers).

### 4.2 IP strategy

- Default: original character roster grows into the product identity (costumes = Slice roadmap's 코스튬 4종 map onto original characters).
- Optional: official IP collaboration (licensed characters) — listed in the v0.2 plan as P2. A license replaces the import mechanism for those characters with bundled, contract-covered assets.
- User import in a commercial build: either (a) removed, or (b) retained with explicit terms of service placing responsibility on the user for personal-use scope, no sharing surface. Decide with legal counsel at that time; (a) is the safe default. This document is not legal advice.

### 4.3 What never changes

Effects celebrate real-world action only; no effect is purchasable power (원칙 1). Motion reduction and skip remain mandatory at every tier. The effect engine, presets, cut-in system, and `CharacterAsset` schema built in Phase A carry through unchanged.

## 5. Verification (Phase A)

Domain: none — this slice touches no domain transitions or rewards. That is itself a test: the domain runner must pass unmodified.

Browser tests:

- Import an image → character renders on the current-step and expedition screens; reload → persists.
- Each preset plays on a completed outcome and is interruptible by tap.
- Expedition departure plays only after the started state renders; a final completion uses one milestone cut-in.
- `partial`, `not_started`, `interrupted`, parked, and blocked transitions produce no FX.
- `prefers-reduced-motion` emulation → only cut-in + soft flash.
- JSON export contains character metadata and zero base64 image data; rolling snapshot size stays flat after import.
- IndexedDB v2 → v3 upgrade preserves all existing v2 records.
- localStorage fallback mode → default character, no crash on import attempt (calm unsupported notice).

## 6. Completion Criteria (Phase A)

The user can register any single image and immediately see it perform all four skill presets with technique-name cut-ins, at the correct loop moments, skippable, motion-reduced when asked, with zero change to rewards, domain state, or backup size.

### Implementation status — complete (2026-07-12)

Phase A is implemented on `codex/stepquest-v02-slice5`. The shipped shell uses `v02-core-4`, precaches all seven v0.2 modules, and keeps character image bytes outside domain state and ordinary backups. Final verification passed the unchanged domain suite, the CI-equivalent command, and the full Playwright matrix: 147 passed, 3 environment-dependent skips, 0 failures across desktop Chrome, mobile Chrome, and mobile Safari.
