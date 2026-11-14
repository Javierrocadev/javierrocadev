import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createProjectMediaFollow} from '../src/scripts/project-media-follow.ts';

function createFakeCta(width = 80, height = 36) {
  const props = new Map();
  return {
    offsetWidth: width,
    offsetHeight: height,
    style: {
      set transform(v) { props.set('transform', v); },
      get transform() { return props.get('transform') ?? ''; },
      removeProperty(k) { props.delete(k); },
    },
    _props: props,
  };
}

function createFakeOverlay(cta, {left = 100, top = 100, width = 400, height = 225} = {}) {
  const overlay = {
    hidden: false,
    clientWidth: width,
    clientHeight: height,
    classList: {contains: () => false},
    getBoundingClientRect() {
      return {left, top, width, height};
    },
    contains(node) {
      return node === overlay || node === cta;
    },
    querySelector(selector) {
      return selector === '.project-media-cta' ? cta : null;
    },
    closest(selector) {
      return selector === '.project-media-overlay' ? overlay : null;
    },
  };
  return overlay;
}

function setupFollowEnv(t, reducedMotion = false) {
  let nextRafId = 1;
  const rafQueue = new Map();
  const root = new EventTarget();
  const window = new EventTarget();
  const motion = new EventTarget();
  motion.matches = reducedMotion;
  window.matchMedia = () => motion;

  const originals = new Map(
    ['window', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );

  Object.assign(globalThis, {
    window,
    requestAnimationFrame(cb) {
      const id = nextRafId++;
      rafQueue.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) {
      rafQueue.delete(id);
    },
  });

  const controller = createProjectMediaFollow({root, padding: 10, smoothing: 0.5});

  t.after(() => {
    controller.disconnect();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  return {
    root,
    window,
    motion,
    controller,
    pendingRafCount: () => rafQueue.size,
    flushRaf() {
      const pending = Array.from(rafQueue.entries());
      rafQueue.clear();
      for (const [, cb] of pending) cb();
    },
    dispatchPointer(type, {pointerType = 'mouse', clientX = 300, clientY = 212.5, target = null, relatedTarget = null} = {}) {
      const event = new Event(type);
      event.pointerType = pointerType;
      event.clientX = clientX;
      event.clientY = clientY;
      Object.defineProperty(event, 'target', {value: target});
      Object.defineProperty(event, 'relatedTarget', {value: relatedTarget});
      root.dispatchEvent(event);
    },
  };
}

test('snaps CTA to entry position, smoothly follows pointermove, and clamps to bounds', (t) => {
  const env = setupFollowEnv(t, false);
  const cta = createFakeCta(80, 36);
  // Center is (300, 212.5). Max X = (400 - 80)/2 - 10 = 150. Max Y = (225 - 36)/2 - 10 = 84.5.
  const overlay = createFakeOverlay(cta, {left: 100, top: 100, width: 400, height: 225});

  env.dispatchPointer('pointerover', {clientX: 340, clientY: 232.5, target: overlay});
  assert.equal(cta.style.transform, 'translate3d(40.00px, 20.00px, 0)');
  assert.equal(env.pendingRafCount(), 0);

  // Move beyond right/bottom corner to verify clamping and smooth lerp.
  env.dispatchPointer('pointermove', {clientX: 1000, clientY: 1000, target: overlay});
  assert.equal(env.pendingRafCount(), 1);
  env.flushRaf();
  // Midpoint from (40, 20) toward clamped (150, 84.5) at smoothing 0.5 -> (95, 52.25)
  assert.equal(cta.style.transform, 'translate3d(95.00px, 52.25px, 0)');

  // Flush until RAF settles and stops automatically.
  for (let i = 0; i < 15 && env.pendingRafCount() > 0; i++) {
    env.flushRaf();
  }
  assert.equal(env.pendingRafCount(), 0);
  assert.equal(cta.style.transform, 'translate3d(150.00px, 84.50px, 0)');
});

test('respects reduced motion, ignores touch, and cleans up on reset/disconnect', (t) => {
  const env = setupFollowEnv(t, false);
  const cta = createFakeCta(80, 36);
  const overlay = createFakeOverlay(cta);

  // Touch events never move the CTA.
  env.dispatchPointer('pointerover', {pointerType: 'touch', clientX: 350, clientY: 250, target: overlay});
  assert.equal(cta.style.transform, '');

  // Mouse moves CTA, then reduced-motion preference turns on and resets transform.
  env.dispatchPointer('pointerover', {pointerType: 'mouse', clientX: 350, clientY: 250, target: overlay});
  assert.notEqual(cta.style.transform, '');

  env.motion.matches = true;
  env.motion.dispatchEvent(new Event('change'));
  assert.equal(cta.style.transform, '');

  env.dispatchPointer('pointermove', {pointerType: 'mouse', clientX: 360, clientY: 250, target: overlay});
  assert.equal(cta.style.transform, '');

  // Re-enable motion, move, then disconnect.
  env.motion.matches = false;
  env.motion.dispatchEvent(new Event('change'));
  env.dispatchPointer('pointerover', {pointerType: 'mouse', clientX: 330, clientY: 220, target: overlay});
  assert.notEqual(cta.style.transform, '');

  env.controller.disconnect();
  assert.equal(cta.style.transform, '');
  assert.equal(env.pendingRafCount(), 0);
});
