#!/usr/bin/env node
const assert = require('node:assert/strict');
const Fx = require('../public/assets/js/stepquest-v02-fx');

function run() {
  for (const preset of ['impact', 'dash', 'slash', 'cast']) {
    const departure = Fx.buildPlan(preset, 'departure', false);
    const completed = Fx.buildPlan(preset, 'completed', false);
    const milestone = Fx.buildPlan(preset, 'milestone', false);
    const preview = Fx.buildPlan(preset, 'preview', false);
    assert.equal(departure.preset, preset);
    assert.ok(departure.duration <= 600);
    assert.ok(completed.duration <= 1200);
    assert.ok(milestone.duration <= 1200);
    assert.ok(preview.duration <= 1200);
    assert.equal(milestone.steps.includes('cutin'), true);
    assert.equal(preview.steps.includes('cutin'), true);
  }

  assert.deepEqual(Fx.buildPlan('slash', 'milestone', true), {
    preset: 'slash',
    mode: 'milestone',
    duration: 120,
    reducedMotion: true,
    steps: ['cutin', 'flash:0.3'],
  });
  assert.throws(() => Fx.buildPlan('bad', 'completed', false), /FX_PRESET_INVALID/);
  assert.throws(() => Fx.buildPlan('impact', 'bad', false), /FX_MODE_INVALID/);

  console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-fx' }, null, 2));
}

run();
