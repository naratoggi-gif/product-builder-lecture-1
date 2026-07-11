(function exposeFx(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02FX = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
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

  return { PRESETS, MODES, buildPlan };
});
