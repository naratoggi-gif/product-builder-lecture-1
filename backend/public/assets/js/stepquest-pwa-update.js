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
    const serviceWorker = navigatorValue?.serviceWorker;
    if (!serviceWorker || !build) {
      return {
        checkForUpdate: async () => null,
        dispose() {},
        registrationPromise: Promise.resolve(null),
      };
    }

    let session = options.sessionStorageValue;
    if (!Object.prototype.hasOwnProperty.call(options, 'sessionStorageValue')) {
      try {
        session = root.sessionStorage;
      } catch (_error) {
        session = null;
      }
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
      } catch (_error) {
        // Updates must not block the app.
      }
    };

    let registrationResolve;
    const registrationPromise = new Promise((resolve) => { registrationResolve = resolve; });
    let registrationStarted = false;

    const startRegistration = () => {
      if (registrationStarted) return registrationPromise;
      registrationStarted = true;
      Promise.resolve()
        .then(() => serviceWorker.register('/sw.js', { updateViaCache: 'none' }))
        .then((value) => {
          registration = value;
          registrationResolve(value);
        })
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
