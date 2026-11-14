import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createProjectRowAnimator, easeInOutElastic} from '../src/scripts/project-filter-animation.ts';

function createFakeRow(height = 200, hidden = false) {
  const styles = new Map();
  return {
    hidden,
    style: {
      setProperty(k, v) { styles.set(k, v); },
      removeProperty(k) { styles.delete(k); },
      get height() { return styles.get('height') ?? ''; },
      set height(v) { styles.set('height', v); },
      get paddingTop() { return styles.get('padding-top') ?? ''; },
      set paddingTop(v) { styles.set('padding-top', v); },
      get paddingBottom() { return styles.get('padding-bottom') ?? ''; },
      set paddingBottom(v) { styles.set('padding-bottom', v); },
      get borderTopWidth() { return styles.get('border-top-width') ?? ''; },
      set borderTopWidth(v) { styles.set('border-top-width', v); },
      get opacity() { return styles.get('opacity') ?? ''; },
      set opacity(v) { styles.set('opacity', v); },
      get transform() { return styles.get('transform') ?? ''; },
      set transform(v) { styles.set('transform', v); },
      get overflow() { return styles.get('overflow') ?? ''; },
      set overflow(v) { styles.set('overflow', v); },
      get transition() { return styles.get('transition') ?? ''; },
      set transition(v) { styles.set('transition', v); },
      get willChange() { return styles.get('will-change') ?? ''; },
      set willChange(v) { styles.set('will-change', v); },
    },
    getBoundingClientRect() {
      const parsed = parseFloat(styles.get('height'));
      return {height: Number.isFinite(parsed) ? parsed : height};
    },
    _styles: styles,
  };
}

function setupEnv(t, reducedMotion = false) {
  let nextId = 1;
  const rafQueue = new Map();
  const originals = new Map(
    ['window', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );

  Object.assign(globalThis, {
    window: {matchMedia: () => ({matches: reducedMotion})},
    getComputedStyle: (el) => ({
      paddingTop: el._styles.get('padding-top') ?? '24px',
      paddingBottom: el._styles.get('padding-bottom') ?? '24px',
      borderTopWidth: el._styles.get('border-top-width') ?? '1px',
      opacity: el._styles.get('opacity') ?? '1',
    }),
    requestAnimationFrame: (cb) => {
      const id = nextId++;
      rafQueue.set(id, cb);
      return id;
    },
    cancelAnimationFrame: (id) => {
      rafQueue.delete(id);
    },
  });

  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  return {
    flush(timestamp) {
      const pending = Array.from(rafQueue.entries());
      rafQueue.clear();
      for (const [, cb] of pending) cb(timestamp);
    },
    pendingCount: () => rafQueue.size,
  };
}

test('easeInOutElastic hits exact boundary values and is symmetric around 0.5', () => {
  assert.equal(easeInOutElastic(0), 0);
  assert.equal(easeInOutElastic(1), 1);
  assert.equal(easeInOutElastic(-0.2), 0);
  assert.equal(easeInOutElastic(1.2), 1);
  assert.ok(Math.abs(easeInOutElastic(0.5) - 0.5) < 1e-12);
  assert.ok(Math.abs(easeInOutElastic(0.35) + easeInOutElastic(0.65) - 1) < 1e-12);
});

test('animates rows in and out using easeInOutElastic and cleans up inline styles', (t) => {
  const env = setupEnv(t, false);
  const entering = createFakeRow(200, true);
  const exiting = createFakeRow(200, false);
  let starts = 0;
  let completes = 0;

  const animator = createProjectRowAnimator({
    durationMs: 600,
    onStart: () => starts++,
    onComplete: () => completes++,
  });

  animator.applyVisibility(
    [
      {element: entering, visible: true},
      {element: exiting, visible: false},
    ],
    {animate: true},
  );

  assert.equal(starts, 1);
  assert.equal(completes, 0);
  assert.equal(entering.hidden, false);
  assert.equal(exiting.hidden, false);
  assert.equal(entering.style.opacity, '0');
  assert.equal(exiting.style.opacity, '1');

  env.flush(100);
  env.flush(250);
  const earlyHeight = parseFloat(entering.style.height);
  assert.ok(earlyHeight > 0 && earlyHeight < 200);

  env.flush(400);
  assert.ok(Math.abs(parseFloat(entering.style.opacity) - 0.5) < 1e-12);
  assert.ok(Math.abs(parseFloat(exiting.style.opacity) - 0.5) < 1e-12);

  env.flush(550);
  const lateHeight = parseFloat(entering.style.height);
  assert.ok(lateHeight > earlyHeight && lateHeight <= 200);

  env.flush(700);
  assert.equal(completes, 1);
  assert.equal(entering.hidden, false);
  assert.equal(exiting.hidden, true);
  assert.equal(entering._styles.size, 0);
  assert.equal(exiting._styles.size, 0);
  assert.equal(env.pendingCount(), 0);
});

test('respects prefers-reduced-motion and interrupts cleanly on rapid filter changes', (t) => {
  const env = setupEnv(t, true);
  const rowA = createFakeRow(200, false);
  const rowB = createFakeRow(200, true);
  let completes = 0;
  const animator = createProjectRowAnimator({onComplete: () => completes++});

  animator.applyVisibility(
    [
      {element: rowA, visible: false},
      {element: rowB, visible: true},
    ],
    {animate: true},
  );

  assert.equal(rowA.hidden, true);
  assert.equal(rowB.hidden, false);
  assert.equal(completes, 1);
  assert.equal(env.pendingCount(), 0);
});
