# StepQuest v0.2 Core 6 Private Media Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misleading legacy private character clips with v2-derived media and make installed PWAs visibly and safely cross the old-document/new-service-worker boundary.

**Architecture:** Add a dependency-injected `StepQuestPwaUpdate` module that owns only registration, update polling, and one-shot reload behavior. Keep build visibility in the v0.2 UI and mount failure presentation in the HTML shell. Produce private media outside Git using image generation for key art and deterministic local animation assembly for delivery formats.

**Tech Stack:** Browser JavaScript IIFEs, Service Worker API, sessionStorage, Playwright, Node assertion scripts, Pillow, ffmpeg WebM encoding, animated WebP, Cloudflare Pages.

## Global Constraints

- Build key is exactly `v02-core-6` in HTML, CSS, every shell JavaScript URL, and the service worker cache.
- A first service-worker installation with no prior controller causes zero reloads.
- Replacing an existing controller causes at most one reload per build and session.
- Update failures never block v0.2 mount or mutate domain/storage state.
- The build marker is visible in every v0.2 route and state.
- Mount failure cannot silently leave the legacy application looking successful.
- Reward amounts, lineage keys, HP, Codex, timer logic, wallet, and DB schema do not change.
- Private character assets remain outside Git, the app shell, and the service worker cache.
- Moving media remains `image/webp` or `video/webm`, ≤ 6,291,456 bytes per file, ≤ 1024px per edge, and ≤ 3000ms.
- Idle plus the selected skill remains ≤ 12,582,912 bytes.
- Commands using Node/npm run from `backend/`; Git commands run from the worktree root.

---

## File Structure

**Create**

- `backend/public/assets/js/stepquest-pwa-update.js` — registration, coalesced update checks, controller transition, one-shot reload.
- `backend/scripts/stepquest-pwa-update-test.js` — dependency-injected lifecycle contracts.
- `assets/sample-character-zenitsu/gen_zenitsu_v2_media.py` — private deterministic animation assembly; never tracked.
- `assets/sample-character-zenitsu/zenitsu_skill_thunderclap.webm` — private recommended skill import; never tracked.

**Modify**

- `backend/public/goals.html` — load core-6 shell, start updater, present mount failure.
- `backend/public/sw.js` — core-6 cache and updater precache.
- `backend/public/assets/js/stepquest-v02-ui.js` — permanent core-6 build marker.
- `backend/public/assets/css/app.css` — build marker and mount-error styles.
- `backend/scripts/stepquest-persistence-test.js` — exact core-6/module/private-exclusion contracts.
- `backend/e2e/stepquest-v02.spec.ts` — visible build, reload guard, and mount failure behavior.
- `backend/package.json` — run the updater pure test in `test:domain`.
- `assets/sample-character-zenitsu/README.md` — private import instructions and v2 lineage; never tracked.
- private canonical and `_legacy` media files under `assets/sample-character-zenitsu/`; never tracked.

---

### Task 1: Pure PWA Update Controller

**Files:**
- Create: `backend/public/assets/js/stepquest-pwa-update.js`
- Create: `backend/scripts/stepquest-pwa-update-test.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: injected `navigatorValue`, `windowValue`, `documentValue`, `locationValue`, `sessionStorageValue`, and build string.
- Produces: `StepQuestPwaUpdate.mount(options) -> { checkForUpdate, dispose, registrationPromise }`.

- [ ] **Step 1: Write the failing lifecycle tests**

Create fake EventTargets and assert these named behaviors:

```js
await test('existing controller reloads exactly once for a new build', async () => {
  const env = createEnvironment({ hasController: true, build: 'v02-core-6' });
  const handle = Update.mount(env.options);
  env.serviceWorker.dispatch('controllerchange');
  env.serviceWorker.dispatch('controllerchange');
  assert.equal(env.reloads, 1);
  assert.equal(env.session.get('stepquest:pwa-reloaded:v02-core-6'), '1');
  handle.dispose();
});

await test('first install claim does not reload', async () => {
  const env = createEnvironment({ hasController: false, build: 'v02-core-6' });
  Update.mount(env.options);
  env.serviceWorker.dispatch('controllerchange');
  assert.equal(env.reloads, 0);
});

await test('foreground checks coalesce registration updates', async () => {
  const env = createEnvironment({ hasController: true, deferredUpdate: true });
  const handle = Update.mount(env.options);
  env.window.dispatch('pageshow');
  env.window.dispatch('focus');
  env.document.visibilityState = 'visible';
  env.document.dispatch('visibilitychange');
  await env.releaseUpdate();
  assert.equal(env.updateCalls, 1);
  await handle.registrationPromise;
});
```

Also cover unsupported service workers, register rejection, update rejection, sessionStorage rejection, `location.reload()` throw, listener disposal, and a later second controller transition after an ignored first-install claim.

- [ ] **Step 2: Run RED**

Run: `node scripts/stepquest-pwa-update-test.js`

Expected: FAIL because `stepquest-pwa-update.js` does not exist.

- [ ] **Step 3: Implement the minimal injected controller**

Use this state machine; do not import domain or storage modules.

```js
(function initPwaUpdate(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestPwaUpdate = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, (root) => {
  function mount(options = {}) {
    const build = String(options.build || '');
    const navigatorValue = options.navigatorValue || root.navigator;
    const windowValue = options.windowValue || root;
    const documentValue = options.documentValue || root.document;
    const locationValue = options.locationValue || root.location;
    const session = options.sessionStorageValue || root.sessionStorage;
    const serviceWorker = navigatorValue?.serviceWorker;
    if (!serviceWorker || !build) {
      return { checkForUpdate: async () => null, dispose() {}, registrationPromise: Promise.resolve(null) };
    }

    const reloadKey = `stepquest:pwa-reloaded:${build}`;
    let controlled = Boolean(serviceWorker.controller);
    let registration = null;
    let updateInFlight = null;
    let disposed = false;

    const onControllerChange = () => {
      const shouldReload = controlled;
      controlled = true;
      if (!shouldReload || disposed) return;
      try {
        if (session.getItem(reloadKey) === '1') return;
        session.setItem(reloadKey, '1');
        locationValue.reload();
      } catch (_error) { /* update must not block the app */ }
    };

    let registrationResolve;
    const registrationPromise = new Promise((resolve) => { registrationResolve = resolve; });
    let registrationStarted = false;

    const startRegistration = () => {
      if (registrationStarted) return registrationPromise;
      registrationStarted = true;
      Promise.resolve()
        .then(() => serviceWorker.register('/sw.js', { updateViaCache: 'none' }))
        .then((value) => { registration = value; registrationResolve(value); })
        .catch(() => registrationResolve(null));
      return registrationPromise;
    };

    const checkForUpdate = () => {
      if (disposed || updateInFlight) return updateInFlight || Promise.resolve(null);
      updateInFlight = startRegistration()
        .then((value) => value?.update?.() || null)
        .catch(() => null)
        .finally(() => { updateInFlight = null; });
      return updateInFlight;
    };

    const onLoad = () => { startRegistration(); };
    const onPageShow = () => { checkForUpdate(); };
    const onFocus = () => { checkForUpdate(); };
    const onVisibility = () => {
      if (documentValue.visibilityState === 'visible') checkForUpdate();
    };
    serviceWorker.addEventListener('controllerchange', onControllerChange);
    windowValue.addEventListener('pageshow', onPageShow);
    windowValue.addEventListener('focus', onFocus);
    documentValue.addEventListener('visibilitychange', onVisibility);
    if (documentValue.readyState === 'complete') startRegistration();
    else windowValue.addEventListener('load', onLoad, { once: true });

    const dispose = () => {
      disposed = true;
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
      windowValue.removeEventListener('load', onLoad);
      windowValue.removeEventListener('pageshow', onPageShow);
      windowValue.removeEventListener('focus', onFocus);
      documentValue.removeEventListener('visibilitychange', onVisibility);
    };
    return { checkForUpdate, dispose, registrationPromise };
  }
  return { mount };
});
```

Implement `dispose()` by removing every registered listener. The `load` handler starts registration; if the module mounts after `load`, start immediately based on `document.readyState === 'complete'`.

- [ ] **Step 4: Run GREEN and the domain suite**

Run:

```powershell
node scripts/stepquest-pwa-update-test.js
npm.cmd run test:domain
```

Expected: updater tests and every existing pure/static test pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/public/assets/js/stepquest-pwa-update.js backend/scripts/stepquest-pwa-update-test.js backend/package.json
git commit -m "Handle StepQuest PWA controller updates"
```

---

### Task 2: Core-6 Shell, Build Marker, and Mount Failure

**Files:**
- Modify: `backend/public/goals.html`
- Modify: `backend/public/sw.js`
- Modify: `backend/public/assets/js/stepquest-v02-ui.js`
- Modify: `backend/public/assets/css/app.css`
- Modify: `backend/scripts/stepquest-persistence-test.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`

**Interfaces:**
- Consumes: `StepQuestPwaUpdate.mount`, `StepQuestV02UI.mount`, current v0.2 render tree.
- Produces: `data-v02-build="v02-core-6"`, `#v02-mount-error`, and exact core-6 shell URLs.

- [ ] **Step 1: Add failing static and browser assertions**

In `stepquest-persistence-test.js`, define the full ordered shell list including:

```js
const pwaUrl = '/assets/js/stepquest-pwa-update.js?v=0.1.1-alpha&build=v02-core-6';
assert.equal(count(goalsHtml, pwaUrl), 1);
assert.equal(count(serviceWorker, `'${pwaUrl}'`), 1);
assert.ok(serviceWorker.includes("const CACHE_BUILD = 'v02-core-6'"));
assert.ok(!goalsHtml.includes('v02-core-5'));
assert.ok(!serviceWorker.includes('v02-core-5'));
```

Keep existing private exclusion tokens and add `zenitsu_skill_thunderclap_v2`, `_legacy`, and `sample-character-zenitsu`.

Add E2E tests with exact titles:

```ts
test('core 6 build marker is visible in every route', async ({ page }) => {
  await resetV02(page);
  await expect(page.locator('[data-v02-build="v02-core-6"]')).toHaveText('Fun Core · v02-core-6');
  await page.locator('#v02-nav-codex').click();
  await expect(page.locator('[data-v02-build="v02-core-6"]')).toBeVisible();
});

test('v0.2 mount failure replaces the legacy shell with a recovery panel', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'StepQuestV02App', {
      configurable: true,
      set(value) { value.init = async () => { throw new Error('MOUNT_PROBE'); }; this.__core = value; },
      get() { return this.__core; },
    });
  });
  await page.goto('/goals');
  await expect(page.locator('#v02-mount-error')).toContainText('v02-core-6');
  await expect(page.locator('#v02-reload-build')).toBeVisible();
  await expect(page.locator('#v02-nav-codex')).toHaveCount(0);
});

test('existing PWA controller transition reloads core 6 exactly once', async ({ page }) => {
  await page.goto('/goals');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.locator('[data-v02-build="v02-core-6"]')).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.removeItem('stepquest:pwa-reloaded:v02-core-6');
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  });
  await page.waitForLoadState('domcontentloaded');
  await expect.poll(() => page.evaluate(() => (
    sessionStorage.getItem('stepquest:pwa-reloaded:v02-core-6')
  ))).toBe('1');
  await expect(page.locator('#v02-nav-codex')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  await expect(page.locator('[data-v02-build="v02-core-6"]')).toBeVisible();
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
node scripts/stepquest-persistence-test.js
npx.cmd playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --grep "core 6 build marker|mount failure|controller transition"
```

Expected: core-6 URLs, marker, and recovery panel are absent.

- [ ] **Step 3: Implement the shell and marker**

- Replace every `v02-core-5` query/cache literal with `v02-core-6`.
- Add the PWA module exactly once before the inline bootstrap.
- Call `StepQuestPwaUpdate.mount({ build: 'v02-core-6', ... })` once.
- Replace the old inline service-worker registration block.
- Render the marker inside the navigation:

```js
const navigation = `
  <nav class="v02-navigation" aria-label="주요 화면">
    <a id="v02-nav-today" href="#today">오늘</a>
    <a id="v02-nav-codex" href="#codex">도감</a>
    <small data-v02-build="v02-core-6">Fun Core · v02-core-6</small>
  </nav>
`;
```

Wrap only `StepQuestV02UI.mount` in a catch and render a neutral recovery panel:

```js
try {
  await window.StepQuestV02UI.mount({ App, Core: window.StepQuestV02App });
} catch (error) {
  App.log(`v0.2 mount: ${error.message}`);
  document.getElementById('app').innerHTML = `
    <section id="v02-mount-error" class="panel v02-mount-error">
      <span class="v02-kicker">Fun Core · v02-core-6</span>
      <h2>새 버전을 여는 중 문제가 생겼습니다.</h2>
      <p>진행 기록은 바꾸지 않았습니다.</p>
      <button id="v02-reload-build">새 버전 다시 열기</button>
    </section>`;
  document.getElementById('v02-reload-build').addEventListener('click', () => location.reload());
}
```

Add 44px target, visible focus, and compact build-marker styles. Do not change unrelated visual rules.

- [ ] **Step 4: Run GREEN**

Run the two RED commands, then:

```powershell
npx.cmd playwright test e2e/stepquest-v02.spec.ts --project=mobile-safari --grep "core 6 build marker|mount failure|controller transition|accessibility"
```

Expected: all pass with no horizontal overflow.

If synthetic `controllerchange` dispatch is not implemented by one browser project, keep the one-shot invariant in the pure injected test and assert production module loading, registration options, session guard, and build marker in that project. Any skip must be explicit and explained; do not add an arbitrary wait.

- [ ] **Step 5: Commit**

```powershell
git add backend/public/goals.html backend/public/sw.js backend/public/assets/js/stepquest-v02-ui.js backend/public/assets/css/app.css backend/scripts/stepquest-persistence-test.js backend/e2e/stepquest-v02.spec.ts
git commit -m "Ship the visible StepQuest core-6 shell"
```

---

### Task 3: V2-Derived Private Character Media

**Files:**
- Read/edit target: `assets/sample-character-zenitsu/zenitsu_skill_thunderclap_v2.png`
- Create/modify private files listed in the File Structure section.
- Never stage any `assets/sample-character-zenitsu/` file.

**Interfaces:**
- Consumes: approved v2 key art and the app media contracts.
- Produces: canonical private portrait, idle WebP, skill WebP, and recommended skill WebM.

- [ ] **Step 1: Preserve the legacy files non-destructively**

Copy the existing canonical files to `_legacy` siblings only when the sibling does not already exist. Verify the SHA-256 of each legacy copy equals its source before replacement.

- [ ] **Step 2: Generate a matching portrait/idle anchor with the built-in image tool**

Use `zenitsu_skill_thunderclap_v2.png` as Image 1, role `identity/style reference and skill edit target`. Generate one project-bound square anchor with this exact prompt contract:

```text
Use case: stylized-concept
Asset type: private game character portrait and idle animation anchor
Input images: Image 1: approved identity, costume, rendering-quality, and lightning-style reference
Primary request: create the same high-detail chibi yellow-haired thunder swordsman in a calm ready stance, one hand resting on the black sword sheath, subtle breathing-ready posture
Scene/backdrop: deep navy-black minimal energy backdrop with only a few faint amber sparks
Style/medium: polished high-detail anime game character illustration matching Image 1
Composition/framing: centered full body, square, generous padding, readable silhouette at 512px
Lighting/mood: restrained warm amber rim light, calm and alive rather than attacking
Constraints: preserve the face, hair silhouette, yellow triangle-pattern haori, black uniform, sword and sheath, body proportions, palette, and rendering quality from Image 1; one character only; no text; no logo; no watermark
Avoid: flat vector art, simplified puppet shapes, oversized head that hides the body, extra weapons, attack slash, cropped feet
```

Inspect the result. Iterate once only if identity, stance, hands, or sword is materially wrong.

- [ ] **Step 3: Assemble deterministic animations**

Create `gen_zenitsu_v2_media.py` using Pillow for transforms/composites, not for inventing new artwork.

- portrait: resize/crop the approved idle anchor to 512×512 PNG.
- idle: 8 frames at 180ms each; vertical offsets `[0,-2,-4,-2,0,2,3,1]`, scale variation within 0.8%, one low-opacity amber spark layer, seamless first/last visual state.
- skill: use the existing v2 image as the main frame. Produce 10 beats with durations `[120,100,70,60,60,80,90,120,160,200]` ms. Use only exposure, crop translation, zoom, directional blur, afterimage opacity, white/amber flash, and lightning overlays; preserve the attack pose.
- WebP: animated, loop 0 for idle; skill file may contain loop metadata because UI mounts it per activation, but first and final frames must not resemble idle.
- WebM: VP8 or VP9, no audio, 30fps or frame-expanded equivalent, exact duration ≤ 1.5s.

- [ ] **Step 4: Validate technical and visual contracts**

Run metadata inspection and actual app imports. Assert:

- portrait 512×512 PNG
- idle/skill dimensions ≤ 1024, duration ≤ 3000ms, bytes ≤ 6,291,456
- idle + WebM skill and idle + WebP skill each ≤ 12,582,912
- browser decode succeeds in Chromium and WebKit
- the skill representative frame visibly matches the approved v2 low-draw pose
- the old SVG crop SHA does not appear in any new canonical frame

Save representative contact sheets beside the private files for user review, but do not stage them.

- [ ] **Step 5: Update private README and keep Git clean**

Document that the recommended phone imports are:

```text
portrait → zenitsu_portrait.png
idle     → zenitsu_idle.webp
skill    → zenitsu_skill_thunderclap.webm
```

Run `git status --short` and verify no private asset is tracked or staged.

---

### Task 4: Full Verification, Review, and Deployment

**Files:**
- All tracked files changed by Tasks 1–3
- Design and plan documents
- No private asset files

**Interfaces:**
- Consumes: completed updater, shell, and private assets.
- Produces: reviewed hotfix branch and deployed core-6 evidence.

- [ ] **Step 1: Run focused verification**

```powershell
npm.cmd run test:domain
npx.cmd playwright test e2e/stepquest-v02.spec.ts --grep "core 6|controller transition|mount failure|Slice 6 shell|owner journey|moving character"
```

- [ ] **Step 2: Run full CI locally**

Run: `npm.cmd run test:ci`

Expected: exit 0; only explained platform skips.

- [ ] **Step 3: Run final static and scope checks**

From the worktree root:

```powershell
git diff --check origin/main...HEAD
git diff --name-only origin/main...HEAD
git status --short
git ls-files | Select-String -Pattern 'zenitsu|sample-character' -CaseSensitive:$false
```

Expected: no private asset match; `.superpowers/` may remain untracked scratch only.

- [ ] **Step 4: Independent review**

Review against the design with special attention to first-install reload suppression, one-shot guard ordering, update failure containment, private exclusion, service-worker URL parity, and mount-error data safety. Fix every Critical/Important finding before publish.

- [ ] **Step 5: Push, PR, CI, merge, and deploy evidence**

After explicit external publish authorization, push the branch, open a PR, wait for StepQuest CI success, merge with expected HEAD, and fetch the public `/goals` and `/sw.js`. Verify both contain `v02-core-6`, the updater module, Fun, and Media.

For the phone handoff, state the one-time transition honestly: fully remove the installed PWA from recent apps and reopen it online once; do not uninstall or clear site data. Then confirm `오늘 / 도감` and `Fun Core · v02-core-6` before importing the private files.

---

## Plan Self-Review

- Spec §§1–7 map to Tasks 1–4.
- No reward, HP, Codex, timer, wallet, or schema file is an implementation target.
- First installation and existing-controller replacement are distinct tests.
- Failure containment covers register, update, storage guard, reload, and mount.
- Private media production has exact prompts, durations, dimensions, byte caps, and canonical names.
- The deployment shell never references private assets.
- No placeholder, ambiguous output path, or unspecified test command remains.
