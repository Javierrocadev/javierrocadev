import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createTrajectoryHighlight} from '../src/scripts/trajectory-hover.ts';

function setup(t) {
  const frames = new Map();
  let nextFrame = 1;
  let hit = null;
  let hitTests = 0;
  const rows = [0, 1].map((index) => ({
    hidden: false,
    isConnected: true,
    rect: {top: 100 + index * 120, height: 120},
    closest(selector) { return selector === '.trajectory-item' ? this : null; },
    getBoundingClientRect() { return this.rect; },
  }));
  const container = {contains: (row) => rows.includes(row), getBoundingClientRect: () => ({top: 100})};
  const highlight = {style: {opacity: '0'}};
  const document = new EventTarget();
  document.elementFromPoint = (x, y) => {
    assert.equal(x, 200);
    assert.equal(y, 350);
    hitTests++;
    return hit;
  };
  const window = new EventTarget();
  const names = ['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const originals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  Object.assign(globalThis, {
    document, window,
    requestAnimationFrame(callback) { frames.set(nextFrame, callback); return nextFrame++; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const tracker = createTrajectoryHighlight({container, highlight});
  t.after(() => {
    tracker.disconnect();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return {
    rows, highlight, document, window, tracker, frames,
    get hitTests() { return hitTests; },
    setHit(value) { hit = value; },
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback()); },
    pointer(pointerType = 'mouse') {
      const event = new Event('pointermove');
      Object.assign(event, {pointerType, clientX: 200, clientY: 350});
      document.dispatchEvent(event);
    },
  };
}

test('trajectory highlight follows the row under a stationary pointer during scroll', (t) => {
  const env = setup(t);
  env.setHit(env.rows[0]);
  env.pointer();
  env.flush();
  assert.deepEqual(env.highlight.style, {top: '0px', height: '120px', opacity: '1'});
  env.setHit({closest: () => env.rows[1]});
  env.window.dispatchEvent(new Event('scroll'));
  env.window.dispatchEvent(new Event('scroll'));
  assert.equal(env.frames.size, 1, 'Scroll events share one frame');
  env.flush();
  assert.deepEqual(env.highlight.style, {top: '120px', height: '120px', opacity: '1'});
  env.setHit(null);
  env.window.dispatchEvent(new Event('scroll'));
  env.flush();
  assert.equal(env.highlight.style.opacity, '0');
  env.setHit(env.rows[0]);
  env.window.dispatchEvent(new Event('scroll'));
  env.flush();
  assert.equal(env.highlight.style.opacity, '1', 'Scroll can bring the section back under the pointer');
});

test('preserves pointer hover and resize updates, and clears on leave, touch, blur and disconnect', (t) => {
  const env = setup(t);
  env.setHit(env.rows[0]);
  env.window.dispatchEvent(new Event('scroll'));
  env.pointer('touch');
  env.flush();
  assert.equal(env.hitTests, 0, 'No mouse position means no hover');
  env.pointer('pen');
  env.flush();
  assert.equal(env.highlight.style.opacity, '1');
  env.rows[0].rect.height = 180;
  env.window.dispatchEvent(new Event('resize'));
  env.flush();
  assert.equal(env.highlight.style.height, '180px');
  for (const [target, type] of [[env.document, 'pointerleave'], [env.document, 'touchstart'], [env.window, 'blur']]) {
    env.pointer();
    target.dispatchEvent(new Event(type));
    env.flush();
    assert.equal(env.highlight.style.opacity, '0');
    assert.equal(env.frames.size, 0);
  }
  env.pointer();
  env.tracker.disconnect();
  env.pointer();
  env.window.dispatchEvent(new Event('scroll'));
  env.flush();
  assert.equal(env.highlight.style.opacity, '0');
  assert.equal(env.frames.size, 0);
});

test('trajectory component initializes the tracker and cleans it up during Astro navigation', async () => {
  const source = await readFile(new URL('../src/components/Sections/Trayectory.astro', import.meta.url), 'utf8');
  assert.match(source, /createTrajectoryHighlight\(\{container, highlight\}\)/);
  assert.match(source, /tracker\.disconnect\(\)/);
  assert.match(source, /astro:page-load/);
  assert.match(source, /astro:before-swap/);
});
