(function exposeFx(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02FX = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (root) => {
  const PRESETS = Object.freeze(['impact', 'dash', 'slash', 'cast']);
  const MODES = Object.freeze(['departure', 'progress', 'completed', 'milestone', 'preview']);
  const DURATIONS = Object.freeze({
    departure: 520,
    progress: 720,
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
  const COMPOSITION_DELAYS = Object.freeze({
    impact: Object.freeze([0, 110, 240, 350, 430]),
    dash: Object.freeze([0, 100, 220, 220, 410]),
    slash: Object.freeze([0, 170, 330, 430]),
    cast: Object.freeze([0, 130, 300, 450]),
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
        steps: mode === 'progress' ? ['flash:0.3'] : ['cutin', 'flash:0.3'],
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

  function addLayer(session, className, stepName, delay = 0, tagName = 'span') {
    const node = session.document.createElement(tagName);
    node.className = className;
    setStep(node, stepName);
    node.setAttribute('data-v02-fx-delay', String(delay));
    node.setAttribute('aria-hidden', 'true');
    session.overlay.append(node);
    session.nodes.push(node);
    return node;
  }

  function animate(session, node, keyframes, options = {}) {
    if (!node?.animate) return Promise.resolve();
    const delay = Math.max(0, Number(options.delay || 0));
    const animation = node.animate(keyframes, {
      duration: Math.max(1, Math.min(
        Number(options.duration || session.plan.duration),
        session.plan.duration - delay,
      )),
      delay,
      easing: options.easing || 'cubic-bezier(.2,.8,.2,1)',
      fill: options.fill || 'forwards',
      iterations: options.iterations || 1,
    });
    session.animations.push(animation);
    return animation.finished.catch(() => undefined);
  }

  function flash(session, intensity, ms, delay = 0) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-flash', 'flash', delay);
    return animate(session, node, [
      { opacity: 0 },
      { opacity: Math.max(0, Math.min(Number(intensity), 1)), offset: 0.28 },
      { opacity: 0 },
    ], { duration: ms || Math.min(260, session.plan.duration), delay });
  }

  function shake(session, px = 8, ms = 360, delay = 0) {
    const amount = Number(px) || 8;
    const target = session.stage.querySelector?.('.v02-character-art') || session.character;
    setStep(target, 'shake');
    target.setAttribute('data-v02-fx-delay', String(delay));
    session.shakeTarget = target;
    return animate(session, target, [
      { transform: 'translate3d(0,0,0)' },
      { transform: `translate3d(${amount}px,${-amount / 2}px,0)` },
      { transform: `translate3d(${-amount}px,${amount / 3}px,0)` },
      { transform: `translate3d(${amount / 2}px,${amount / 2}px,0)` },
      { transform: 'translate3d(0,0,0)' },
    ], { duration: Math.min(ms, session.plan.duration), delay, easing: 'linear' });
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

  function afterimage(session, count = 3, delay = 0) {
    const promises = [];
    for (let index = 0; index < count; index += 1) {
      const clone = session.character.cloneNode(true);
      clone.removeAttribute?.('id');
      clone.querySelectorAll?.('[id]').forEach((node) => node.removeAttribute('id'));
      clone.classList.add('v02-fx-afterimage');
      setStep(clone, 'afterimage');
      clone.setAttribute('data-v02-fx-delay', String(delay));
      clone.setAttribute('aria-hidden', 'true');
      placeFromCharacter(session, clone);
      session.overlay.append(clone);
      session.nodes.push(clone);
      promises.push(animate(session, clone, [
        { opacity: 0.44 - (index * 0.1), transform: `translateX(${-18 - (index * 16)}px)` },
        { opacity: 0, transform: `translateX(${18 + (index * 12)}px)` },
      ], { duration: Math.min(520, session.plan.duration), delay }));
    }
    return Promise.all(promises);
  }

  function shockring(session, color, delay = 0) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-shockring', 'shockring', delay);
    node.style.borderColor = color;
    return animate(session, node, [
      { opacity: 0.9, transform: 'translate(-50%,-50%) scale(.15)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(2.25)' },
    ], { duration: Math.min(620, session.plan.duration), delay });
  }

  function svgLayer(session, className, stepName, delay = 0) {
    const svg = session.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('v02-fx-layer', className);
    setStep(svg, stepName);
    svg.setAttribute('data-v02-fx-delay', String(delay));
    session.overlay.append(svg);
    session.nodes.push(svg);
    return svg;
  }

  function bolt(session, color, delay = 0) {
    const svg = svgLayer(session, 'v02-fx-bolt', 'bolt', delay);
    const line = session.document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', '8,8 43,38 29,49 71,92 58,57 77,48');
    line.setAttribute('stroke', color);
    svg.append(line);
    return animate(session, svg, [
      { opacity: 0, transform: 'scale(.9)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.2 },
      { opacity: 0, transform: 'scale(1.04)' },
    ], { duration: Math.min(460, session.plan.duration), delay, easing: 'steps(3, end)' });
  }

  function arc(session, color, delay = 0) {
    const svg = svgLayer(session, 'v02-fx-arc', 'arc', delay);
    const path = session.document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 8 78 Q 48 5 94 31');
    path.setAttribute('stroke', color);
    path.setAttribute('pathLength', '1');
    svg.append(path);
    return animate(session, path, [
      { strokeDashoffset: 1, opacity: 0.2 },
      { strokeDashoffset: 0, opacity: 1, offset: 0.58 },
      { strokeDashoffset: 0, opacity: 0 },
    ], { duration: Math.min(620, session.plan.duration), delay });
  }

  function cutin(session, text, color, delay = 0) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-cutin', 'cutin', delay);
    const label = session.document.createElement('strong');
    label.textContent = String(text || '첫걸음').slice(0, 40);
    label.style.color = color;
    node.append(label);
    return animate(session, node, [
      { opacity: 0, transform: 'translateX(-12%) skewX(-8deg)' },
      { opacity: 1, transform: 'translateX(0) skewX(-8deg)', offset: 0.28 },
      { opacity: 1, transform: 'translateX(0) skewX(-8deg)', offset: 0.72 },
      { opacity: 0, transform: 'translateX(10%) skewX(-8deg)' },
    ], { duration: session.plan.duration, delay });
  }

  function speedLines(session, delay = 0) {
    const node = addLayer(session, 'v02-fx-layer v02-fx-speedlines', 'speedlines', delay);
    for (let index = 0; index < 12; index += 1) node.append(session.document.createElement('i'));
    return animate(session, node, [
      { opacity: 0, transform: 'scale(.92)' },
      { opacity: 0.75, transform: 'scale(1.04)', offset: 0.35 },
      { opacity: 0, transform: 'scale(1.12)' },
    ], { duration: Math.min(500, session.plan.duration), delay });
  }

  function transformCharacter(session, kind, delay = 0) {
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
    session.character.setAttribute('data-v02-fx-delay', String(delay));
    session.markedCharacter = true;
    return animate(session, session.character, frames, {
      duration: Math.min(600, session.plan.duration),
      delay,
    });
  }

  function summoningCircle(session, color, delay = 0) {
    const node = addLayer(
      session,
      'v02-fx-layer v02-fx-summoning-circle',
      'summoning-circle',
      delay,
    );
    node.style.borderColor = color;
    return animate(session, node, [
      { opacity: 0, transform: 'translate(-50%,-50%) rotate(0) scale(.55)' },
      { opacity: 0.85, transform: 'translate(-50%,-50%) rotate(130deg) scale(1)', offset: 0.52 },
      { opacity: 0, transform: 'translate(-50%,-50%) rotate(260deg) scale(1.18)' },
    ], { duration: Math.min(760, session.plan.duration), delay, easing: 'linear' });
  }

  function compositionDelay(plan, rawStep, index) {
    const [stepName] = rawStep.split(':');
    if (plan.reducedMotion || stepName === 'cutin') return 0;
    return Math.min(
      COMPOSITION_DELAYS[plan.preset][index] || 0,
      Math.max(0, plan.duration - 1),
    );
  }

  function runPrimitive(session, rawStep, options, delay) {
    const [stepName, stepValue] = rawStep.split(':');
    const color = options.color || '#65d9ff';
    if (stepName === 'flash') {
      return flash(session, Number(stepValue), session.plan.reducedMotion ? 120 : undefined, delay);
    }
    if (stepName === 'shake') return shake(session, 8, 360, delay);
    if (stepName === 'afterimage') return afterimage(session, 3, delay);
    if (stepName === 'shockring') return shockring(session, color, delay);
    if (stepName === 'bolt') return bolt(session, color, delay);
    if (stepName === 'arc') return arc(session, color, delay);
    if (stepName === 'cutin') return cutin(session, options.skillName, color, delay);
    if (stepName === 'speedlines') return speedLines(session, delay);
    if (stepName === 'translate') return transformCharacter(session, stepValue, delay);
    if (stepName === 'summoning-circle') return summoningCircle(session, color, delay);
    return Promise.resolve();
  }

  function composePreset(session, options) {
    return session.plan.steps.map((rawStep, index) => runPrimitive(
      session,
      rawStep,
      options,
      compositionDelay(session.plan, rawStep, index),
    ));
  }

  function finish(session, skipped) {
    if (!session || session.finished) return;
    session.finished = true;
    if (session.timer) root.clearTimeout(session.timer);
    session.animations.forEach((animation) => {
      try { animation.cancel(); } catch (_error) { /* no-op */ }
    });
    if (session.shakeTarget) {
      session.shakeTarget.removeAttribute('data-v02-fx-step');
      session.shakeTarget.removeAttribute('data-v02-fx-delay');
    }
    if (session.markedCharacter) {
      session.character.removeAttribute('data-v02-fx-step');
      session.character.removeAttribute('data-v02-fx-delay');
    }
    if (session.keyHandler) session.document.removeEventListener('keydown', session.keyHandler, true);
    if (session.abortHandler) session.signal?.removeEventListener('abort', session.abortHandler);
    session.overlay.remove();
    if (activeSession === session) activeSession = null;
    const focusTarget = session.focusReturnTarget;
    if (focusTarget?.isConnected && typeof focusTarget.focus === 'function') {
      try { focusTarget.focus({ preventScroll: true }); } catch (_error) { focusTarget.focus(); }
    }
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
    cancel();
    if (options.signal?.aborted) {
      return Promise.resolve({ skipped: true, mode: plan.mode, preset: plan.preset });
    }
    if (!documentValue?.createElement || !stage?.append || !character) {
      return Promise.resolve({ skipped: true, mode: plan.mode, preset: plan.preset });
    }

    const priorFocus = documentValue.activeElement;
    const logicalControl = stage.closest?.('section')?.querySelector('button');
    const interactive = options.interactive !== false;
    const focusReturnTarget = interactive && (options.restoreFocus || (
      priorFocus && priorFocus !== documentValue.body ? priorFocus : logicalControl
    ));
    const overlay = documentValue.createElement('div');
    overlay.className = 'v02-fx-overlay';
    overlay.tabIndex = -1;
    overlay.setAttribute('data-v02-fx-overlay', '');
    overlay.setAttribute('data-v02-fx-mode', plan.mode);
    overlay.setAttribute('data-v02-fx-preset', plan.preset);
    overlay.setAttribute('data-v02-fx-duration', String(plan.duration));
    overlay.style.setProperty('--v02-fx-color', options.color || '#65d9ff');

    let skip = null;
    if (interactive) {
      skip = documentValue.createElement('button');
      skip.type = 'button';
      skip.setAttribute('data-v02-fx-skip', '');
      skip.textContent = '연출 건너뛰기';
      overlay.append(skip);
    }

    const session = {
      document: documentValue,
      stage,
      character,
      overlay,
      plan,
      animations: [],
      nodes: [],
      finished: false,
      shakeTarget: null,
      markedCharacter: false,
      timer: null,
      resolve: null,
      keyHandler: null,
      abortHandler: null,
      signal: options.signal || null,
      focusReturnTarget,
    };
    activeSession = session;

    const stopPointer = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (interactive) {
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
    }
    if (session.signal) {
      session.abortHandler = () => finish(session, true);
      session.signal.addEventListener('abort', session.abortHandler, { once: true });
    }
    stage.append(overlay);
    if (skip) {
      try { skip.focus({ preventScroll: true }); } catch (_error) { skip.focus?.(); }
    }

    const effects = composePreset(session, options);
    Promise.allSettled(effects).catch(() => undefined);

    return new Promise((resolve) => {
      session.resolve = resolve;
      session.timer = root.setTimeout(() => finish(session, false), plan.duration);
    });
  }

  return { PRESETS, MODES, buildPlan, play, cancel };
});
