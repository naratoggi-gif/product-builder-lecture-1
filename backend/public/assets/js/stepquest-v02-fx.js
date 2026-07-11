(function exposeFx(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02FX = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (root) => {
  const PRESETS = Object.freeze(['impact', 'dash', 'slash', 'cast']);
  const MODES = Object.freeze(['departure', 'completed', 'milestone', 'preview']);
  const DURATIONS = Object.freeze({
    departure: 520,
    completed: 1050,
    milestone: 1200,
    preview: 1050,
  });
  const PRESET_STEPS = Object.freeze({
    impact: Object.freeze(['translate:dash', 'flash:0.85', 'shockring', 'shake', 'speedlines']),
    dash: Object.freeze(['flash:0.45', 'bolt', 'afterimage', 'translate:dash', 'shockring']),
    slash: Object.freeze(['translate:leap', 'arc', 'flash:0.75', 'shake']),
    cast: Object.freeze(['translate:hover', 'summoning-circle', 'shockring', 'flash:0.65']),
  });

  let activeSession = null;

  function buildPlan(preset, mode, reducedMotion = false) {
    if (!PRESETS.includes(preset)) throw new Error('FX_PRESET_INVALID');
    if (!MODES.includes(mode)) throw new Error('FX_MODE_INVALID');
    if (reducedMotion) {
      return {
        preset,
        mode,
        duration: 120,
        reducedMotion: true,
        steps: ['cutin', 'flash:0.3'],
      };
    }
    const fullSteps = [...PRESET_STEPS[preset]];
    const steps = mode === 'departure'
      ? fullSteps.slice(0, 3)
      : mode === 'milestone' || mode === 'preview'
        ? [...fullSteps, 'cutin']
        : fullSteps;
    return {
      preset,
      mode,
      duration: DURATIONS[mode],
      reducedMotion: false,
      steps,
    };
  }

  function setStep(node, name) {
    node.setAttribute('data-v02-fx-step', name);
    return node;
  }

  function addLayer(session, className, stepName, tagName = 'span') {
    const node = session.document.createElement(tagName);
    node.className = className;
    setStep(node, stepName);
    node.setAttribute('aria-hidden', 'true');
    session.overlay.append(node);
    session.nodes.push(node);
    return node;
  }

  function animate(session, node, keyframes, options = {}) {
    if (!node?.animate) return Promise.resolve();
    const animation = node.animate(keyframes, {
      duration: Math.min(Number(options.duration || session.plan.duration), session.plan.duration),
      easing: options.easing || 'cubic-bezier(.2,.8,.2,1)',
      fill: options.fill || 'both',
      iterations: options.iterations || 1,
    });
    session.animations.push(animation);
    return animation.finished.catch(() => undefined);
  }

  function flash(session, intensity, ms) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-flash', 'flash');
    return animate(session, node, [
      { opacity: 0 },
      { opacity: Math.max(0, Math.min(Number(intensity), 1)), offset: 0.28 },
      { opacity: 0 },
    ], { duration: ms || Math.min(260, session.plan.duration) });
  }

  function shake(session, px = 8, ms = 360) {
    const amount = Number(px) || 8;
    setStep(session.stage, 'shake');
    session.markedStage = true;
    return animate(session, session.stage, [
      { transform: 'translate3d(0,0,0)' },
      { transform: `translate3d(${amount}px,${-amount / 2}px,0)` },
      { transform: `translate3d(${-amount}px,${amount / 3}px,0)` },
      { transform: `translate3d(${amount / 2}px,${amount / 2}px,0)` },
      { transform: 'translate3d(0,0,0)' },
    ], { duration: Math.min(ms, session.plan.duration), easing: 'linear' });
  }

  function placeFromCharacter(session, node) {
    const stageBox = session.stage.getBoundingClientRect();
    const box = session.character.getBoundingClientRect();
    Object.assign(node.style, {
      left: `${box.left - stageBox.left}px`,
      top: `${box.top - stageBox.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
  }

  function afterimage(session, count = 3) {
    const promises = [];
    for (let index = 0; index < count; index += 1) {
      const clone = session.character.cloneNode(true);
      clone.removeAttribute?.('id');
      clone.querySelectorAll?.('[id]').forEach((node) => node.removeAttribute('id'));
      clone.classList.add('v02-fx-afterimage');
      setStep(clone, 'afterimage');
      clone.setAttribute('aria-hidden', 'true');
      placeFromCharacter(session, clone);
      session.overlay.append(clone);
      session.nodes.push(clone);
      promises.push(animate(session, clone, [
        { opacity: 0.44 - (index * 0.1), transform: `translateX(${-18 - (index * 16)}px)` },
        { opacity: 0, transform: `translateX(${18 + (index * 12)}px)` },
      ], { duration: Math.min(520, session.plan.duration) }));
    }
    return Promise.all(promises);
  }

  function shockring(session, color) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-shockring', 'shockring');
    node.style.borderColor = color;
    return animate(session, node, [
      { opacity: 0.9, transform: 'translate(-50%,-50%) scale(.15)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(2.25)' },
    ], { duration: Math.min(620, session.plan.duration) });
  }

  function svgLayer(session, className, stepName) {
    const svg = session.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('v02-fx-layer', className);
    setStep(svg, stepName);
    session.overlay.append(svg);
    session.nodes.push(svg);
    return svg;
  }

  function bolt(session, color) {
    const svg = svgLayer(session, 'v02-fx-bolt', 'bolt');
    const line = session.document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', '8,8 43,38 29,49 71,92 58,57 77,48');
    line.setAttribute('stroke', color);
    svg.append(line);
    return animate(session, svg, [
      { opacity: 0, transform: 'scale(.9)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.2 },
      { opacity: 0, transform: 'scale(1.04)' },
    ], { duration: Math.min(460, session.plan.duration), easing: 'steps(3, end)' });
  }

  function arc(session, color) {
    const svg = svgLayer(session, 'v02-fx-arc', 'arc');
    const path = session.document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 8 78 Q 48 5 94 31');
    path.setAttribute('stroke', color);
    path.setAttribute('pathLength', '1');
    svg.append(path);
    return animate(session, path, [
      { strokeDashoffset: 1, opacity: 0.2 },
      { strokeDashoffset: 0, opacity: 1, offset: 0.58 },
      { strokeDashoffset: 0, opacity: 0 },
    ], { duration: Math.min(620, session.plan.duration) });
  }

  function cutin(session, text, color) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-cutin', 'cutin');
    const label = session.document.createElement('strong');
    label.textContent = String(text || '첫걸음').slice(0, 40);
    label.style.color = color;
    node.append(label);
    return animate(session, node, [
      { opacity: 0, transform: 'translateX(-12%) skewX(-8deg)' },
      { opacity: 1, transform: 'translateX(0) skewX(-8deg)', offset: 0.28 },
      { opacity: 1, transform: 'translateX(0) skewX(-8deg)', offset: 0.72 },
      { opacity: 0, transform: 'translateX(10%) skewX(-8deg)' },
    ], { duration: session.plan.duration });
  }

  function speedLines(session) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-speedlines', 'speedlines');
    for (let index = 0; index < 12; index += 1) node.append(session.document.createElement('i'));
    return animate(session, node, [
      { opacity: 0, transform: 'scale(.92)' },
      { opacity: 0.75, transform: 'scale(1.04)', offset: 0.35 },
      { opacity: 0, transform: 'scale(1.12)' },
    ], { duration: Math.min(500, session.plan.duration) });
  }

  function transformCharacter(session, kind) {
    const frames = {
      dash: [
        { transform: 'translateX(-16%) scale(.96)' },
        { transform: 'translateX(10%) scale(1.04)', offset: 0.62 },
        { transform: 'translateX(0) scale(1)' },
      ],
      leap: [
        { transform: 'translateY(0) rotate(0)' },
        { transform: 'translateY(-16%) rotate(-4deg)', offset: 0.48 },
        { transform: 'translateY(0) rotate(0)' },
      ],
      hover: [
        { transform: 'translateY(0)' },
        { transform: 'translateY(-9%)', offset: 0.45 },
        { transform: 'translateY(0)' },
      ],
    }[kind] || [{ transform: 'none' }, { transform: 'none' }];
    setStep(session.character, 'translate');
    session.markedCharacter = true;
    return animate(session, session.character, frames, { duration: Math.min(600, session.plan.duration) });
  }

  function summoningCircle(session, color) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-summoning-circle', 'summoning-circle');
    node.style.borderColor = color;
    return animate(session, node, [
      { opacity: 0, transform: 'translate(-50%,-50%) rotate(0) scale(.55)' },
      { opacity: 0.85, transform: 'translate(-50%,-50%) rotate(130deg) scale(1)', offset: 0.52 },
      { opacity: 0, transform: 'translate(-50%,-50%) rotate(260deg) scale(1.18)' },
    ], { duration: Math.min(760, session.plan.duration), easing: 'linear' });
  }

  function finish(session, skipped) {
    if (!session || session.finished) return;
    session.finished = true;
    if (session.timer) root.clearTimeout(session.timer);
    session.animations.forEach((animation) => {
      try { animation.cancel(); } catch (_error) { /* no-op */ }
    });
    if (session.markedStage) session.stage.removeAttribute('data-v02-fx-step');
    if (session.markedCharacter) session.character.removeAttribute('data-v02-fx-step');
    session.document.removeEventListener('keydown', session.keyHandler, true);
    session.overlay.remove();
    if (activeSession === session) activeSession = null;
    session.resolve?.({ skipped, mode: session.plan.mode, preset: session.plan.preset });
  }

  function cancel() {
    if (activeSession) finish(activeSession, true);
  }

  function play(options = {}) {
    const documentValue = options.documentValue || root?.document;
    const stage = options.stage;
    const character = options.character;
    const plan = buildPlan(options.preset, options.mode, Boolean(options.reducedMotion));
    if (!documentValue?.createElement || !stage?.append || !character) {
      return Promise.resolve({ skipped: true, mode: plan.mode, preset: plan.preset });
    }

    cancel();
    const overlay = documentValue.createElement('div');
    overlay.className = 'v02-fx-overlay';
    overlay.tabIndex = -1;
    overlay.setAttribute('data-v02-fx-overlay', '');
    overlay.setAttribute('data-v02-fx-mode', plan.mode);
    overlay.setAttribute('data-v02-fx-preset', plan.preset);
    overlay.setAttribute('data-v02-fx-duration', String(plan.duration));
    overlay.style.setProperty('--v02-fx-color', options.color || '#65d9ff');

    const skip = documentValue.createElement('button');
    skip.type = 'button';
    skip.setAttribute('data-v02-fx-skip', '');
    skip.textContent = '연출 건너뛰기';
    overlay.append(skip);

    const session = {
      document: documentValue,
      stage,
      character,
      overlay,
      plan,
      animations: [],
      nodes: [],
      finished: false,
      markedStage: false,
      markedCharacter: false,
      timer: null,
      resolve: null,
      keyHandler: null,
    };
    activeSession = session;

    const stopPointer = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    overlay.addEventListener('pointerdown', stopPointer, true);
    overlay.addEventListener('pointerup', stopPointer, true);
    overlay.addEventListener('click', (event) => {
      stopPointer(event);
      finish(session, true);
    }, true);
    session.keyHandler = (event) => {
      if (!['Escape', 'Enter', ' ', 'Spacebar'].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish(session, true);
    };
    documentValue.addEventListener('keydown', session.keyHandler, true);
    stage.append(overlay);
    try { overlay.focus({ preventScroll: true }); } catch (_error) { overlay.focus?.(); }

    const color = options.color || '#65d9ff';
    const effects = plan.steps.map((rawStep) => {
      const [stepName, stepValue] = rawStep.split(':');
      if (stepName === 'flash') {
        return flash(session, Number(stepValue), plan.reducedMotion ? 120 : undefined);
      }
      if (stepName === 'shake') return shake(session);
      if (stepName === 'afterimage') return afterimage(session);
      if (stepName === 'shockring') return shockring(session, color);
      if (stepName === 'bolt') return bolt(session, color);
      if (stepName === 'arc') return arc(session, color);
      if (stepName === 'cutin') return cutin(session, options.skillName, color);
      if (stepName === 'speedlines') return speedLines(session);
      if (stepName === 'translate') return transformCharacter(session, stepValue);
      if (stepName === 'summoning-circle') return summoningCircle(session, color);
      return Promise.resolve();
    });
    Promise.allSettled(effects).catch(() => undefined);

    return new Promise((resolve) => {
      session.resolve = resolve;
      session.timer = root.setTimeout(() => finish(session, false), plan.duration);
    });
  }

  return { PRESETS, MODES, buildPlan, play, cancel };
});
