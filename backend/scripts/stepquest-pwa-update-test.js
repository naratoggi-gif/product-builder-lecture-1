#!/usr/bin/env node
const assert = require('node:assert/strict');
const Update = require('../public/assets/js/stepquest-pwa-update.js');

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, once: Boolean(options?.once) });
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry.listener !== listener));
  }

  dispatch(type) {
    const entries = [...(this.listeners.get(type) || [])];
    entries.forEach((entry) => {
      if (entry.once) this.removeEventListener(type, entry.listener);
      entry.listener({ type, target: this });
    });
  }

  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }
}

function createEnvironment(options = {}) {
  const windowValue = new FakeEventTarget();
  const documentValue = new FakeEventTarget();
  const serviceWorker = new FakeEventTarget();
  const session = new Map();
  const registerArguments = [];
  let reloads = 0;
  let registerCalls = 0;
  let updateCalls = 0;
  let resolveDeferredUpdate = null;
  let updateStarted = false;

  documentValue.readyState = options.readyState || 'loading';
  documentValue.visibilityState = options.visibilityState || 'hidden';
  serviceWorker.controller = options.hasController ? {} : null;

  const registration = {
    update() {
      updateCalls += 1;
      updateStarted = true;
      if (options.updateReject) return Promise.reject(new Error('update failed'));
      if (options.deferredUpdate) {
        return new Promise((resolve) => { resolveDeferredUpdate = resolve; });
      }
      return Promise.resolve(null);
    },
  };

  serviceWorker.register = (url, registrationOptions) => {
    registerCalls += 1;
    registerArguments.push([url, registrationOptions]);
    if (options.registerReject) return Promise.reject(new Error('register failed'));
    return Promise.resolve(registration);
  };

  const sessionStorageValue = {
    getItem(key) {
      if (options.sessionGetThrows) throw new Error('session read failed');
      return session.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.sessionSetThrows) throw new Error('session write failed');
      session.set(key, String(value));
    },
  };

  const locationValue = {
    reload() {
      reloads += 1;
      if (options.reloadThrows) throw new Error('reload failed');
    },
  };

  const mountOptions = {
    build: options.build === undefined ? 'v02-core-6' : options.build,
    navigatorValue: options.unsupported ? {} : { serviceWorker },
    windowValue,
    documentValue,
    locationValue,
  };
  if (!options.omitSessionStorageInjection) mountOptions.sessionStorageValue = sessionStorageValue;

  return {
    window: windowValue,
    document: documentValue,
    serviceWorker,
    session,
    registerArguments,
    get reloads() { return reloads; },
    get registerCalls() { return registerCalls; },
    get updateCalls() { return updateCalls; },
    options: mountOptions,
    async releaseUpdate() {
      for (let attempt = 0; attempt < 8 && !updateStarted; attempt += 1) {
        await Promise.resolve();
      }
      assert.equal(updateStarted, true, 'update should start within bounded microtasks');
      resolveDeferredUpdate?.(null);
      await Promise.resolve();
    },
  };
}

async function test(name, callback) {
  await callback();
  return name;
}

async function run() {
  const completed = [];

  completed.push(await test('existing controller reloads exactly once for a new build', async () => {
    const env = createEnvironment({ hasController: true, build: 'v02-core-6' });
    const handle = Update.mount(env.options);
    env.serviceWorker.dispatch('controllerchange');
    env.serviceWorker.dispatch('controllerchange');
    assert.equal(env.reloads, 1);
    assert.equal(env.session.get('stepquest:pwa-reloaded:v02-core-6'), '1');
    handle.dispose();
  }));

  completed.push(await test('first install claim does not reload', async () => {
    const env = createEnvironment({ hasController: false, build: 'v02-core-6' });
    const handle = Update.mount(env.options);
    env.serviceWorker.dispatch('controllerchange');
    assert.equal(env.reloads, 0);
    handle.dispose();
  }));

  completed.push(await test('foreground checks coalesce registration updates', async () => {
    const env = createEnvironment({ hasController: true, deferredUpdate: true });
    const handle = Update.mount(env.options);
    env.window.dispatch('pageshow');
    env.window.dispatch('focus');
    env.document.visibilityState = 'visible';
    env.document.dispatch('visibilitychange');
    await env.releaseUpdate();
    assert.equal(env.updateCalls, 1);
    assert.equal(env.registerCalls, 1);
    assert.deepEqual(env.registerArguments, [['/sw.js', { updateViaCache: 'none' }]]);
    await handle.registrationPromise;
    handle.dispose();
  }));

  completed.push(await test('unsupported service workers return a resolved no-op handle', async () => {
    const env = createEnvironment({ unsupported: true });
    const handle = Update.mount(env.options);
    assert.equal(await handle.registrationPromise, null);
    assert.equal(await handle.checkForUpdate(), null);
    assert.equal(env.window.listenerCount('load'), 0);
    assert.equal(env.window.listenerCount('pageshow'), 0);
    assert.equal(env.document.listenerCount('visibilitychange'), 0);
    handle.dispose();
  }));

  completed.push(await test('missing build returns a resolved no-op handle', async () => {
    const env = createEnvironment({ build: '' });
    const handle = Update.mount(env.options);
    assert.equal(await handle.registrationPromise, null);
    assert.equal(await handle.checkForUpdate(), null);
    assert.equal(env.serviceWorker.listenerCount('controllerchange'), 0);
    handle.dispose();
  }));

  completed.push(await test('throwing sessionStorage property getter does not block update bootstrap', async () => {
    const env = createEnvironment({
      hasController: true,
      readyState: 'complete',
      omitSessionStorageInjection: true,
    });
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('SESSION_GETTER'); },
    });

    try {
      let handle;
      assert.doesNotThrow(() => { handle = Update.mount(env.options); });
      await handle.registrationPromise;
      assert.equal(env.registerCalls, 1);
      assert.equal(await handle.checkForUpdate(), null);
      assert.equal(env.updateCalls, 1);
      assert.doesNotThrow(() => env.serviceWorker.dispatch('controllerchange'));
      assert.equal(env.reloads, 0);
      handle.dispose();
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'sessionStorage', originalDescriptor);
      else delete globalThis.sessionStorage;
    }
  }));

  completed.push(await test('register rejection resolves registration and update checks to null', async () => {
    const env = createEnvironment({ readyState: 'complete', registerReject: true });
    const handle = Update.mount(env.options);
    assert.equal(await handle.registrationPromise, null);
    assert.equal(await handle.checkForUpdate(), null);
    assert.equal(env.registerCalls, 1);
    assert.equal(env.updateCalls, 0);
    handle.dispose();
  }));

  completed.push(await test('update rejection resolves the check to null', async () => {
    const env = createEnvironment({ readyState: 'complete', updateReject: true });
    const handle = Update.mount(env.options);
    await handle.registrationPromise;
    assert.equal(await handle.checkForUpdate(), null);
    assert.equal(env.updateCalls, 1);
    handle.dispose();
  }));

  completed.push(await test('sessionStorage read rejection does not block controller changes', async () => {
    const env = createEnvironment({ hasController: true, sessionGetThrows: true });
    const handle = Update.mount(env.options);
    assert.doesNotThrow(() => env.serviceWorker.dispatch('controllerchange'));
    assert.equal(env.reloads, 0);
    handle.dispose();
  }));

  completed.push(await test('sessionStorage write rejection does not reload or escape', async () => {
    const env = createEnvironment({ hasController: true, sessionSetThrows: true });
    const handle = Update.mount(env.options);
    assert.doesNotThrow(() => env.serviceWorker.dispatch('controllerchange'));
    assert.equal(env.reloads, 0);
    handle.dispose();
  }));

  completed.push(await test('location reload throw is contained after setting the build guard', async () => {
    const env = createEnvironment({ hasController: true, reloadThrows: true });
    const handle = Update.mount(env.options);
    assert.doesNotThrow(() => env.serviceWorker.dispatch('controllerchange'));
    env.serviceWorker.dispatch('controllerchange');
    assert.equal(env.reloads, 1);
    assert.equal(env.session.get('stepquest:pwa-reloaded:v02-core-6'), '1');
    handle.dispose();
  }));

  completed.push(await test('dispose removes every lifecycle listener', async () => {
    const env = createEnvironment({ hasController: true });
    const handle = Update.mount(env.options);
    assert.equal(env.serviceWorker.listenerCount('controllerchange'), 1);
    assert.equal(env.window.listenerCount('load'), 1);
    assert.equal(env.window.listenerCount('pageshow'), 1);
    assert.equal(env.window.listenerCount('focus'), 1);
    assert.equal(env.document.listenerCount('visibilitychange'), 1);

    handle.dispose();
    assert.equal(env.serviceWorker.listenerCount('controllerchange'), 0);
    assert.equal(env.window.listenerCount('load'), 0);
    assert.equal(env.window.listenerCount('pageshow'), 0);
    assert.equal(env.window.listenerCount('focus'), 0);
    assert.equal(env.document.listenerCount('visibilitychange'), 0);

    env.serviceWorker.dispatch('controllerchange');
    env.window.dispatch('load');
    env.window.dispatch('pageshow');
    env.window.dispatch('focus');
    env.document.visibilityState = 'visible';
    env.document.dispatch('visibilitychange');
    await Promise.resolve();
    assert.equal(env.reloads, 0);
    assert.equal(env.registerCalls, 0);
    assert.equal(await handle.checkForUpdate(), null);
  }));

  completed.push(await test('a later second controller transition reloads after an ignored first-install claim', async () => {
    const env = createEnvironment({ hasController: false });
    const handle = Update.mount(env.options);
    env.serviceWorker.dispatch('controllerchange');
    assert.equal(env.reloads, 0);
    env.serviceWorker.dispatch('controllerchange');
    assert.equal(env.reloads, 1);
    assert.equal(env.session.get('stepquest:pwa-reloaded:v02-core-6'), '1');
    handle.dispose();
  }));

  completed.push(await test('load starts registration once for a loading document', async () => {
    const env = createEnvironment({ readyState: 'loading' });
    const handle = Update.mount(env.options);
    assert.equal(env.registerCalls, 0);
    env.window.dispatch('load');
    await handle.registrationPromise;
    env.window.dispatch('load');
    await Promise.resolve();
    assert.equal(env.registerCalls, 1);
    assert.deepEqual(env.registerArguments, [['/sw.js', { updateViaCache: 'none' }]]);
    handle.dispose();
  }));

  completed.push(await test('complete document starts registration immediately', async () => {
    const env = createEnvironment({ readyState: 'complete' });
    const handle = Update.mount(env.options);
    await handle.registrationPromise;
    assert.equal(env.registerCalls, 1);
    assert.equal(env.window.listenerCount('load'), 0);
    handle.dispose();
  }));

  console.log(JSON.stringify({
    ok: true,
    checked: 'stepquest-pwa-update',
    tests: completed.length,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
