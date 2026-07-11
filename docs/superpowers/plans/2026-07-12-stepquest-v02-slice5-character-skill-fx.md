# StepQuest v0.2 Slice 5 Character & Skill FX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner import one device-local character image, preview four dependency-free skill effects, and see the selected effect at the correct StepQuest departure/completion moments without changing domain state, rewards, or ordinary backup size.

**Architecture:** Keep character metadata and image Blobs in two IndexedDB presentation stores outside the JSON-cloned domain state. Add a small character utility for validation/downscaling/export and an isolated DOM/WAAPI FX engine; the existing app facade owns persistence while the v0.2 UI renders a stage and starts effects only after the new state is on screen.

**Tech Stack:** Browser IndexedDB v3, Blob/Object URL/Canvas APIs, DOM + Web Animations API, plain JavaScript IIFEs, existing Nest/Helmet shell, Node assertion scripts, Playwright.

## Global Constraints

- Implement Phase A only; no roster, gallery, sharing, cloud image sync, original-character pack, paper-doll, sprite-sheet, skeletal animation, or third-party runtime dependency.
- Do not modify `backend/public/assets/js/stepquest-v02-domain.js` or any StepCoin/Gold rule.
- Accept only PNG/WebP/JPG, redraw to PNG with the longest edge at most 512px, and keep all image bytes device-local.
- IndexedDB upgrade is additive from version 2 to version 3; all existing v2 records must survive.
- Ordinary JSON, rolling snapshots, and automatic external backups contain character metadata but no Blob, data URL, or base64; only the explicit manual full export may include base64.
- Live loop triggers use the character's selected preset; all four presets remain available as manual previews.
- Departure runs at most 600ms; completed/milestone runs at most 1.2s; the final step plays one milestone animation, not two effects.
- `partial`, `not_started`, `interrupted`, deferred, blocked, and waiting transitions never trigger FX.
- Tap, the visible skip button, Escape, Enter, and Space cancel an effect without activating the underlying UI.
- Reduced motion means technique cut-in plus one 120ms flash at intensity 0.3, whether requested by media query or the in-app setting.
- Fixed cache build for this slice is `v02-core-4` across HTML, service worker, and assertions.
- Use Korean, non-blaming copy and escape all character-provided text through `App.h()`.
- Run every Node/npm/Playwright command below from `backend`; run every Git command from the worktree root.

---

### Task 1: Lock Character, Backup, and FX Contracts with Pure RED Tests

**Files:**
- Create: `backend/scripts/stepquest-v02-character-test.js`
- Create: `backend/scripts/stepquest-v02-fx-test.js`
- Modify: `backend/scripts/stepquest-v02-backup-test.js`
- Modify: `backend/package.json`
- Create: `backend/public/assets/js/stepquest-v02-character.js`
- Create: `backend/public/assets/js/stepquest-v02-fx.js`
- Modify: `backend/public/assets/js/stepquest-v02-backup.js`

**Interfaces:**
- Produces `StepQuestV02Character.PALETTE`, `fitWithin(width, height, maxEdge)`, `normalizeMetadata(input, now)`, `prepareImage(file)`, and `blobToBase64(blob)`.
- Produces `StepQuestV02FX.buildPlan(preset, mode, reducedMotion)` and later `play(options)`/`cancel()`.
- Extends `StepQuestV02Backup.buildExport(records, now)` with `schemaVersion: 3` and `characters` metadata.
- Produces `StepQuestV02Backup.buildFullExport(records, encodedAssets, now)` for explicit manual image export.
- Task 3 later extends `StepQuestV02Backup.downloadJson(json, documentValue, urlApi, filename)`; Task 1 leaves the current three-argument behavior unchanged.

- [ ] **Step 1: Write failing character contract tests**

Create assertions equivalent to:

```js
const assert = require('node:assert/strict');
const Character = require('../public/assets/js/stepquest-v02-character.js');

assert.equal(Character.PALETTE.length, 8);
assert.deepEqual(Character.fitWithin(1024, 256, 512), { width: 512, height: 128 });
assert.deepEqual(Character.fitWithin(240, 480, 512), { width: 240, height: 480 });
const metadata = Character.normalizeMetadata({
  name: '<b>용사</b>', skillPreset: 'dash', skillName: '벽력일섬', accentColor: Character.PALETTE[0],
}, '2026-07-12T00:00:00.000Z');
assert.equal(metadata.id, 'local-primary');
assert.equal(metadata.name, '<b>용사</b>');
assert.throws(() => Character.normalizeMetadata({ skillPreset: 'unknown' }), /CHARACTER_PRESET_INVALID/);
assert.throws(() => Character.normalizeMetadata({ accentColor: '#123456' }), /CHARACTER_COLOR_INVALID/);
```

- [ ] **Step 2: Write failing backup contract tests**

Extend the existing test so a regular export built from records containing `characters` and fake `assets` satisfies:

```js
assert.equal(exported.schemaVersion, 3);
assert.deepEqual(exported.characters, [character]);
assert.equal('assets' in exported, false);
assert.equal(JSON.stringify(exported).includes('base64'), false);

const full = Backup.buildFullExport(records, [{ id: 'asset-1', mimeType: 'image/png', base64: 'AA==' }], now);
assert.equal(full.exportType, 'full-with-images');
assert.deepEqual(full.assets, [{ id: 'asset-1', mimeType: 'image/png', base64: 'AA==' }]);
```

- [ ] **Step 3: Write failing FX plan tests**

Create one assertion per preset and trigger mode:

```js
const Fx = require('../public/assets/js/stepquest-v02-fx.js');
for (const preset of ['impact', 'dash', 'slash', 'cast']) {
  const departure = Fx.buildPlan(preset, 'departure', false);
  const completed = Fx.buildPlan(preset, 'completed', false);
  assert.ok(departure.duration <= 600);
  assert.ok(completed.duration <= 1200);
}
assert.deepEqual(Fx.buildPlan('slash', 'milestone', true), {
  preset: 'slash', mode: 'milestone', duration: 120,
  reducedMotion: true, steps: ['cutin', 'flash:0.3'],
});
assert.throws(() => Fx.buildPlan('bad', 'completed', false), /FX_PRESET_INVALID/);
```

- [ ] **Step 4: Run the focused scripts and observe RED**

Run:

```powershell
node scripts/stepquest-v02-character-test.js
node scripts/stepquest-v02-fx-test.js
node scripts/stepquest-v02-backup-test.js
```

Expected: the first two fail because their production modules do not exist; backup fails because schema 2 has no character/full export contract.

- [ ] **Step 5: Implement the minimal pure contracts**

Use a UMD-style IIFE matching the existing modules. `normalizeMetadata` must return exactly:

```js
{
  id: 'local-primary',
  name: String(input.name || '').trim().slice(0, 40) || '나의 모험가',
  imageBlobKey: String(input.imageBlobKey || 'character:local-primary:image'),
  skillPreset: input.skillPreset || 'impact',
  skillName: String(input.skillName || '').trim().slice(0, 40) || '첫걸음',
  accentColor: input.accentColor || PALETTE[0],
  createdAt: input.createdAt || now,
  updatedAt: now,
}
```

`buildPlan` must return deterministic step names and capped durations. `buildExport` must copy only `records.characters || []`; `buildFullExport` must spread the regular export and add `exportType` plus the supplied encoded assets.

- [ ] **Step 6: Run focused scripts and the unchanged domain runner for GREEN**

Run:

```powershell
node scripts/stepquest-v02-character-test.js
node scripts/stepquest-v02-fx-test.js
node scripts/stepquest-v02-backup-test.js
node scripts/stepquest-v02-domain-test.js
```

Expected: all four print their `{ "ok": true }` result; the domain test remains unchanged.

- [ ] **Step 7: Add the two new pure scripts to `test:domain` and commit**

Place character and FX scripts before the backup script in `backend/package.json`, then run `npm.cmd run test:domain` and commit:

```powershell
git add backend/package.json backend/scripts/stepquest-v02-character-test.js backend/scripts/stepquest-v02-fx-test.js backend/scripts/stepquest-v02-backup-test.js backend/public/assets/js/stepquest-v02-character.js backend/public/assets/js/stepquest-v02-fx.js backend/public/assets/js/stepquest-v02-backup.js
git commit -m "Add Slice 5 character and FX contracts"
```

---

### Task 2: Upgrade IndexedDB to v3 and Persist One Local Character

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-storage.js`
- Modify: `backend/public/assets/js/stepquest-v02-app.js`
- Modify: `backend/scripts/stepquest-persistence-test.js`
- Modify: `backend/e2e/stepquest-v02-storage.spec.ts`
- Modify: `backend/e2e/stepquest-v02.spec.ts`

**Interfaces:**
- Repository produces `getCharacter()`, `getCharacterBlob(key)`, `saveCharacter(metadata, blob)`, and `exportCharacterAssets()` in both modes.
- IndexedDB implementations persist Blob data; localStorage implementations return `null`/empty records and reject writes with `CHARACTER_IMAGE_STORAGE_UNAVAILABLE`.
- Facade produces `getCharacter()`, `importCharacter(input)`, `exportFullJson()`, and augments completed report results with `goalMilestone` derived from before/after snapshots.

- [ ] **Step 1: Add RED static and browser tests for the v3 schema**

The persistence script must require:

```js
assert.ok(storage.includes('const DB_VERSION = 3;'));
assert.ok(storage.includes("createStore(database, 'characters', { keyPath: 'id' })"));
assert.ok(storage.includes("createStore(database, 'assets', { keyPath: 'id' })"));
```

In Playwright, create a real version-2 `stepquest` database containing one Goal, Step, wallet row, and backup. Reload the app and assert:

```ts
expect(await page.evaluate(async () => {
  const db = await openStepQuestDatabase();
  return {
    version: db.version,
    stores: [...db.objectStoreNames],
    goal: await requestValue(db.transaction('goals').objectStore('goals').get('goal-v2')),
    step: await requestValue(db.transaction('steps').objectStore('steps').get('step-v2')),
    wallet: await requestValue(db.transaction('wallet').objectStore('wallet').get('main')),
    backups: await requestValue(db.transaction('backups').objectStore('backups').getAll()),
  };
})).toMatchObject({
  version: 3,
  stores: expect.arrayContaining(['characters', 'assets']),
  goal: { id: 'goal-v2' },
  step: { id: 'step-v2', goalId: 'goal-v2' },
  wallet: { id: 'main', stepCoin: 9, gold: 2 },
  backups: [{ id: 'backup-v2' }],
});
```

- [ ] **Step 2: Run focused tests and observe RED**

Build once, then run the named Playwright test directly:

```powershell
node scripts/stepquest-persistence-test.js
npm.cmd run build
npx.cmd playwright test --grep "upgrades v2 character stores"
```

Expected: schema assertions fail against DB version 2 and missing stores.

- [ ] **Step 3: Add presentation stores without putting them in domain state**

Set `DB_VERSION = 3`, add `PRESENTATION_STORES = ['characters', 'assets']`, and create both stores in `onupgradeneeded`. Do not add them to `STATE_STORES`, `readRecords`, `writeState`, `partitionRecords`, or the JSON-cloned domain snapshot. Include `characters` (never `assets`) in transactions that rotate rolling backups so `rotateBackups` can attach current metadata without image bytes.

`saveCharacter` must perform one transaction spanning the domain read stores, `backups`, `characters`, and `assets`: persist the replacement and rotate a `saveCharacter` snapshot containing domain state plus current character metadata, never the Blob.

```js
const previous = await requestResult(characterStore.get(metadata.id));
assetStore.put({ id: metadata.imageBlobKey, blob, mimeType: blob.type, updatedAt: metadata.updatedAt });
characterStore.put(clone(metadata));
if (previous?.imageBlobKey && previous.imageBlobKey !== metadata.imageBlobKey) assetStore.delete(previous.imageBlobKey);
const { state } = partitionRecords(await readRecords(transaction));
await rotateBackups(transaction, { ...state, characters: [clone(metadata)] }, 'saveCharacter', metadata.updatedAt);
await done;
return clone(metadata);
```

For domain-triggered rolling backups, `rotateBackups` must read `characters.getAll()` and merge that metadata into the stored snapshot. The five-snapshot retention rule remains unchanged.

- [ ] **Step 4: Add fallback stubs and safe export boundaries**

The localStorage repository must expose the same methods but never serialize a Blob:

```js
getCharacter: async () => null,
getCharacterBlob: async () => null,
saveCharacter: async () => { throw new Error('CHARACTER_IMAGE_STORAGE_UNAVAILABLE'); },
exportCharacterAssets: async () => ({ characters: [], assets: [] }),
```

IndexedDB `exportRecords()` returns `{ ...state, backups, characters }` and no `assets`. `exportCharacterAssets()` returns metadata and Blob records only for the explicit full-export path.

- [ ] **Step 5: Add facade loading, replacement, full export, and milestone derivation**

Cache the character view model and revoke its old Object URL on replacement. `importCharacter` must call `StepQuestV02Character.prepareImage(file)`, normalize metadata, save it, refresh the Object URL, then call `afterSignificantCommit()` so the external JSON receives metadata only.

Derive milestone without changing the domain result:

```js
const step = snapshot.steps.find((item) => item.id === expedition.stepId);
const wasComplete = snapshot.goals.find((item) => item.id === step.goalId)?.status === 'completed';
const transition = await repository.execute('reportOutcome', command);
snapshot = transition.state;
const isComplete = snapshot.goals.find((item) => item.id === step.goalId)?.status === 'completed';
return { ...transition.result, goalMilestone: !wasComplete && isComplete };
```

- [ ] **Step 6: Run focused storage, backup, and domain tests for GREEN**

Run:

```powershell
node scripts/stepquest-persistence-test.js
node scripts/stepquest-v02-backup-test.js
node scripts/stepquest-v02-domain-test.js
npm.cmd run build
npx.cmd playwright test --grep "upgrades v2 character stores"
```

Expected: all pass and the v2 fixture remains intact after opening v3.

- [ ] **Step 7: Commit the storage boundary**

```powershell
git add backend/public/assets/js/stepquest-v02-storage.js backend/public/assets/js/stepquest-v02-app.js backend/scripts/stepquest-persistence-test.js backend/e2e/stepquest-v02-storage.spec.ts backend/e2e/stepquest-v02.spec.ts
git commit -m "Persist local Slice 5 character assets"
```

---

### Task 3: Render, Import, Replace, and Export the Character

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-character.js`
- Modify: `backend/public/assets/js/stepquest-v02-backup.js`
- Modify: `backend/public/assets/js/stepquest-v02-ui.js`
- Modify: `backend/public/assets/css/app.css`
- Modify: `backend/src/main.ts`
- Modify: `backend/scripts/stepquest-persistence-test.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`
- Modify: `backend/e2e/stepquest-v02-storage.spec.ts`

**Interfaces:**
- `prepareImage(file)` resolves `{ blob, width, height }` after MIME validation, image decode, longest-edge resize, and PNG encoding.
- UI renders `[data-v02-character-stage]`, `#v02-character-image` for a Blob-backed character, or `.v02-default-character` for fallback.
- UI exposes `#v02-character-file`, metadata fields, `#v02-save-character`, and `#v02-export-character-full` only when IndexedDB supports images.

- [ ] **Step 1: Write RED browser tests for import, reload, replacement, fallback, and export**

Use `page.setInputFiles('#v02-character-file', { name: 'hero.png', mimeType: 'image/png', buffer: tinyPng })`, fill the fields, and click save. Assert:

```ts
await expect(page.locator('#v02-character-image')).toHaveAttribute('src', /^blob:/);
await expect(page.locator('[data-v02-character-name]')).toHaveText('나의 영웅');
await page.reload();
await expect(page.locator('#v02-character-image')).toHaveAttribute('src', /^blob:/);
```

Intercept no network for the imported image, inspect `characters`/`assets` directly, and assert ordinary export has metadata but `JSON.stringify(exported)` contains neither `data:image` nor `base64`. In forced localStorage mode, assert the default character and calm notice are visible and saving is unavailable.

- [ ] **Step 2: Run the focused browser tests and observe RED**

Build once, then run the named Playwright tests directly:

```powershell
npm.cmd run build
npx.cmd playwright test --grep "local character"
```

Expected: selectors and character stores are missing.

- [ ] **Step 3: Implement browser image preparation**

Reject files whose `type` is not exactly `image/png`, `image/webp`, or `image/jpeg`. Load through a temporary Object URL, draw into a canvas sized by `fitWithin`, and resolve `canvas.toBlob(..., 'image/png')`. Revoke the temporary URL in both success and error paths. Reject with stable errors `CHARACTER_IMAGE_TYPE_UNSUPPORTED`, `CHARACTER_IMAGE_DECODE_FAILED`, or `CHARACTER_IMAGE_ENCODE_FAILED` while leaving the current record unchanged.

- [ ] **Step 4: Render the stage and settings without exposing user markup**

Create a reusable `characterStage()` string used in both the active-step and active-expedition panels. Render all metadata with `h()`. The settings block must contain the exact copyright copy:

```html
<p>가져온 이미지는 이 기기에만 저장되며 개인 사용 범위에서만 쓰세요.</p>
```

When `Core.getStatus().mode === 'localStorage'`, render the CSS default character plus `이 브라우저에서는 캐릭터 이미지를 저장할 수 없어 기본 캐릭터를 사용합니다.` and no enabled file-save action.

- [ ] **Step 5: Add manual full-export wiring**

Extend `downloadJson` with an optional fourth `filename = 'stepquest-backup.json'` argument. The button must call `Core.exportFullJson()` and `StepQuestV02Backup.downloadJson(json, document, URL, 'stepquest-full-backup-with-images.json')`. Keep `#v02-export` and automatic backup on `Core.exportJson()`.

- [ ] **Step 6: Permit only Blob images in CSP and verify no upload path exists**

Change only Helmet's image directive:

```ts
imgSrc: ["'self'", 'data:', 'blob:'],
```

Add a static assertion for `'blob:'`; do not add Blob permissions to scripts, connections, workers, or forms.

- [ ] **Step 7: Run focused browser and static tests for GREEN**

Run:

```powershell
node scripts/stepquest-persistence-test.js
npm.cmd run build
npx.cmd playwright test --grep "local character"
```

Expected: import, reload, replacement, ordinary export exclusion, manual full export, and fallback tests pass.

- [ ] **Step 8: Commit the character UI**

```powershell
git add backend/public/assets/js/stepquest-v02-character.js backend/public/assets/js/stepquest-v02-backup.js backend/public/assets/js/stepquest-v02-ui.js backend/public/assets/css/app.css backend/src/main.ts backend/scripts/stepquest-persistence-test.js backend/e2e/stepquest-v02.spec.ts backend/e2e/stepquest-v02-storage.spec.ts
git commit -m "Add local character import and stage"
```

---

### Task 4: Implement Skippable DOM/WAAPI FX and Correct Loop Triggers

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-fx.js`
- Modify: `backend/public/assets/js/stepquest-v02-ui.js`
- Modify: `backend/public/assets/css/app.css`
- Modify: `backend/scripts/stepquest-v02-fx-test.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`

**Interfaces:**
- `StepQuestV02FX.play({ stage, character, preset, skillName, color, mode, reducedMotion })` returns a Promise resolving `{ skipped, mode, preset }` and never mutates app state.
- `StepQuestV02FX.cancel()` synchronously removes the active overlay and cancels every WAAPI animation.
- UI `run(button, action, afterRender)` renders the committed state first and invokes `afterRender(result)` in a microtask without awaiting it.

- [ ] **Step 1: Write RED browser tests for timing, trigger exclusions, skip, and reduced motion**

Instrument the DOM using `[data-v02-fx-overlay]`, `[data-v02-fx-step]`, and `[data-v02-fx-mode]`. Test all four preview buttons, then assert:

```ts
await page.click('#v02-start-step');
await expect(page.locator('#v02-expedition-active')).toBeVisible();
await expect(page.locator('[data-v02-fx-mode="departure"]')).toBeVisible();

await page.click('[data-v02-fx-skip]');
await expect(page.locator('[data-v02-fx-overlay]')).toHaveCount(0);
```

Start a second preview, click a non-button point on `[data-v02-fx-overlay]`, and assert it is removed while the underlying StepQuest control receives no click. Repeat cancellation with Escape, Enter, and Space.

Complete a non-final step and expect one `completed` overlay; complete a final step and expect one `milestone` overlay with a cut-in. Report partial, not-started, and interrupted in separate fixtures and assert no overlay is created. Emulate reduced motion and assert only `cutin` and `flash` step markers exist with `data-v02-fx-duration="120"`.

- [ ] **Step 2: Run focused FX tests and observe RED**

Run:

```powershell
node scripts/stepquest-v02-fx-test.js
npm.cmd run build
npx.cmd playwright test --grep "skill FX"
```

Expected: pure plan tests pass from Task 1, while DOM playback and trigger selectors fail because `play` is not implemented.

- [ ] **Step 3: Implement the six primitives and four preset composers**

Create one overlay per play. Keep all created nodes and `Animation` objects in an active session so `cancel()` can remove/cancel them. Primitives return their animation Promise but preset composition uses `Promise.all`/short sequencing internally. Private helpers implement speed lines, transform, and summoning-circle layers. Clamp every plan to its duration cap.

- [ ] **Step 4: Implement input-safe cancellation and reduced motion**

The overlay must contain `<button type="button" data-v02-fx-skip>연출 건너뛰기</button>`, cover the stage, stop pointer propagation, and call `cancel()` when the overlay itself is tapped. Add a temporary document key handler for Escape/Enter/Space and remove it in cleanup. Reduced mode must call only `cutin()` plus `flash(0.3, 120)` and skip every transform/shake/afterimage/bolt/arc/ring helper.

- [ ] **Step 5: Trigger effects only after committed state renders**

Change `run` to:

```js
const result = await action();
if (result === false) button.disabled = false;
else {
  render();
  if (afterRender) Promise.resolve().then(() => afterRender(result)).catch(() => {});
}
```

The start action must `return Core.startCurrentStep(...)`; completed report actions must `return Core.reportCurrentExpedition(...)`, and both call `run(button, action, afterRender)`. Departure uses the selected preset with mode `departure`. A `completed` report uses `result.goalMilestone ? 'milestone' : 'completed'`. Every other outcome omits the callback. `play()` is never awaited by the command path.

- [ ] **Step 6: Run focused and full v0.2 browser tests for GREEN**

Run:

```powershell
node scripts/stepquest-v02-fx-test.js
npm.cmd run build
npx.cmd playwright test --grep "skill FX|StepQuest v0.2"
```

Expected: all four presets, departure, completed, milestone, skip, keyboard cancel, reduced motion, and exclusion cases pass with the post-state screen visible before the overlay.

- [ ] **Step 7: Commit FX integration**

```powershell
git add backend/public/assets/js/stepquest-v02-fx.js backend/public/assets/js/stepquest-v02-ui.js backend/public/assets/css/app.css backend/scripts/stepquest-v02-fx-test.js backend/e2e/stepquest-v02.spec.ts
git commit -m "Add skippable Slice 5 skill effects"
```

---

### Task 5: Ship the New Modules Through the PWA Shell and Close Regression Coverage

**Files:**
- Modify: `backend/public/goals.html`
- Modify: `backend/public/sw.js`
- Modify: `backend/scripts/stepquest-persistence-test.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`
- Modify: `backend/e2e/stepquest-v02-storage.spec.ts`
- Modify: `docs/2026-07-11-stepquest-v02-slice5-character-skill-fx.md`
- Modify: `docs/superpowers/plans/2026-07-12-stepquest-v02-slice5-character-skill-fx.md`

**Interfaces:**
- `goals.html` loads Domain → Storage → Backup → Character → FX → legacy App → v0.2 App → v0.2 UI.
- Service worker precaches the same seven v0.2 URLs and uses `CACHE_BUILD = 'v02-core-4'`.

- [ ] **Step 1: Add RED exact-shell assertions before changing HTML or SW**

Require all seven exact URLs in both sources and reject the old key:

```js
const modules = ['domain', 'storage', 'backup', 'character', 'fx', 'app', 'ui'];
for (const name of modules) {
  const url = `/assets/js/stepquest-v02-${name}.js?v=0.1.1-alpha&build=v02-core-4`;
  assert.ok(goalsHtml.includes(url));
  assert.ok(serviceWorker.includes(`'${url}'`));
}
assert.ok(!goalsHtml.includes('v02-core-3'));
assert.ok(!serviceWorker.includes('v02-core-3'));
assert.ok(serviceWorker.includes("const CACHE_BUILD = 'v02-core-4';"));
```

- [ ] **Step 2: Run the persistence script and observe RED**

Run `node scripts/stepquest-persistence-test.js`.

Expected: missing Character/FX asset and old build-key assertions fail.

- [ ] **Step 3: Update HTML load order, precache list, and cache build together**

Add Character and FX before `stepquest-v02-app.js`; replace every v0.2 `build=v02-core-3` with `build=v02-core-4`; set `CACHE_BUILD` to `v02-core-4`; precache the exact new module URLs.

- [ ] **Step 4: Run CI-equivalent verification**

Run fresh commands from `backend`:

```powershell
npm.cmd run test:domain
npm.cmd run test:e2e
npm.cmd run test:ci
```

Expected: build exits 0; every domain/static script passes; Playwright reports zero failures. Confirm the existing domain test file has no diff.

- [ ] **Step 5: Run source and requirement checks**

Run:

```powershell
git diff --check
git status --short
git diff -- backend/public/assets/js/stepquest-v02-domain.js
rg -n "v02-core-3|data:image|base64" backend/public/goals.html backend/public/sw.js backend/public/assets/js
```

Expected: no whitespace errors; no domain diff; old cache key absent; `base64` appears only in the explicit full-export implementation/tests and never in ordinary export/automatic backup code.

- [ ] **Step 6: Exercise the built browser flow manually**

Start the built server, import one image, preview all presets, start an expedition, skip departure FX, complete it, reload, and verify the image remains. Inspect IndexedDB to confirm one `characters` row and one Blob asset. Export ordinary and full JSON and verify only the full file contains base64.

- [ ] **Step 7: Mark plan checkboxes, commit final shell/test changes, and request review**

```powershell
git add backend/public/goals.html backend/public/sw.js backend/scripts/stepquest-persistence-test.js backend/e2e/stepquest-v02.spec.ts backend/e2e/stepquest-v02-storage.spec.ts docs/2026-07-11-stepquest-v02-slice5-character-skill-fx.md docs/superpowers/plans/2026-07-12-stepquest-v02-slice5-character-skill-fx.md
git commit -m "Complete StepQuest v0.2 Slice 5"
```

Ask an independent reviewer to compare the branch against the Phase A completion criteria before pushing or opening the PR.
