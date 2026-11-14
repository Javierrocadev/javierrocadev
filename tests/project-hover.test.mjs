import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createProjectHoverTracker} from '../src/scripts/project-hover.ts';

function createClassList() {
  const set = new Set();
  return {
    add(name) { set.add(name); },
    remove(name) { set.delete(name); },
    contains(name) { return set.has(name); },
  };
}

function createFakeRow(index) {
  const row = {
    index,
    hidden: false,
    isConnected: true,
    classList: createClassList(),
    closest(selector) {
      return selector === '[data-project-row]' ? row : null;
    },
    compareDocumentPosition(other) {
      if (!other || other === row) return 0;
      return other.index < row.index ? 2 : 4;
    },
  };
  return row;
}

function createFakeChild(row) {
  return {
    closest(selector) {
      return selector === '[data-project-row]' ? row : null;
    },
  };
}

function setupHoverEnv(t, rows) {
  let nextRafId = 1;
  const rafQueue = new Map();
  let hitElement = null;

  const document = new EventTarget();
  document.elementFromPoint = () => hitElement;

  const window = new EventTarget();
  window.scrollY = 0;

  const root = {
    contains(el) {
      return rows.includes(el);
    },
  };

  const originals = new Map(
    ['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );

  Object.assign(globalThis, {
    document,
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

  const changes = [];
  const tracker = createProjectHoverTracker({
    root,
    onHoverChange(row) {
      changes.push(row);
    },
  });

  t.after(() => {
    tracker.disconnect();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  return {
    tracker,
    document,
    window,
    changes,
    setHit(el) {
      hitElement = el;
    },
    flushRaf() {
      const pending = Array.from(rafQueue.entries());
      rafQueue.clear();
      for (const [, cb] of pending) cb();
    },
    dispatchPointer(type, {pointerType = 'mouse', clientX = 120, clientY = 300, target = null} = {}) {
      const event = new Event(type);
      event.pointerType = pointerType;
      event.clientX = clientX;
      event.clientY = clientY;
      Object.defineProperty(event, 'target', {value: target});
      document.dispatchEvent(event);
    },
  };
}

test('updates hovered project row on scroll with stationary pointer', (t) => {
  const rowA = createFakeRow(0);
  const rowB = createFakeRow(1);
  const env = setupHoverEnv(t, [rowA, rowB]);

  env.dispatchPointer('pointermove', {clientX: 200, clientY: 400, target: createFakeChild(rowA)});
  assert.equal(rowA.classList.contains('is-hovered'), true);
  assert.equal(rowB.classList.contains('is-hovered'), false);
  assert.deepEqual(env.changes, [rowA]);

  // User scrolls down without moving the pointer; cursor now lands over rowB.
  env.setHit(createFakeChild(rowB));
  env.window.scrollY = 250;
  env.window.dispatchEvent(new Event('scroll'));
  env.flushRaf();

  assert.equal(rowA.classList.contains('is-hovered'), false);
  assert.equal(rowB.classList.contains('is-hovered'), true);
  assert.deepEqual(env.changes, [rowA, rowB]);
});

test('prevents downward-scroll boundary bounce while allowing upward-scroll return', (t) => {
  const rowA = createFakeRow(0);
  const rowB = createFakeRow(1);
  const env = setupHoverEnv(t, [rowA, rowB]);

  env.dispatchPointer('pointermove', {clientX: 200, clientY: 400, target: rowB});
  assert.equal(rowB.classList.contains('is-hovered'), true);

  // Synthetic pointerover at exact same coordinates from rowA shrinking should be ignored.
  env.dispatchPointer('pointerover', {clientX: 200, clientY: 400, target: rowA});
  assert.equal(rowB.classList.contains('is-hovered'), true);

  // Continuing to scroll downward when rowA collapses into cursor spot must not snap back to rowA.
  env.setHit(rowA);
  env.window.scrollY = 100;
  env.window.dispatchEvent(new Event('scroll'));
  env.flushRaf();
  assert.equal(rowB.classList.contains('is-hovered'), true);
  assert.equal(rowA.classList.contains('is-hovered'), false);

  // Scrolling upward DOES switch back to rowA.
  env.window.scrollY = 40;
  env.window.dispatchEvent(new Event('scroll'));
  env.flushRaf();
  assert.equal(rowA.classList.contains('is-hovered'), true);
  assert.equal(rowB.classList.contains('is-hovered'), false);
});

test('sync() updates hovered row after filtering and ignores touch / pointerleave / disconnect', (t) => {
  const rowA = createFakeRow(0);
  const rowB = createFakeRow(1);
  const env = setupHoverEnv(t, [rowA, rowB]);

  // Touch events must not set hover.
  env.dispatchPointer('pointermove', {pointerType: 'touch', clientX: 150, clientY: 320, target: rowA});
  assert.equal(rowA.classList.contains('is-hovered'), false);

  // Mouse enters rowA, then filtering hides rowA and brings rowB under the stationary cursor.
  env.dispatchPointer('pointermove', {pointerType: 'mouse', clientX: 150, clientY: 320, target: rowA});
  assert.equal(rowA.classList.contains('is-hovered'), true);

  rowA.hidden = true;
  env.setHit(rowB);
  env.tracker.sync();
  assert.equal(rowA.classList.contains('is-hovered'), false);
  assert.equal(rowB.classList.contains('is-hovered'), true);

  // pointerleave clears hover and stops scroll reactivation until pointer returns.
  env.document.dispatchEvent(new Event('pointerleave'));
  assert.equal(rowB.classList.contains('is-hovered'), false);

  env.window.scrollY = 120;
  env.window.dispatchEvent(new Event('scroll'));
  env.flushRaf();
  assert.equal(rowB.classList.contains('is-hovered'), false);

  // touchstart also clears active mouse hover.
  env.dispatchPointer('pointerover', {pointerType: 'mouse', clientX: 150, clientY: 320, target: rowB});
  assert.equal(rowB.classList.contains('is-hovered'), true);
  env.document.dispatchEvent(new Event('touchstart'));
  assert.equal(rowB.classList.contains('is-hovered'), false);

  // disconnect clears everything and stops listening.
  env.dispatchPointer('pointermove', {pointerType: 'mouse', clientX: 150, clientY: 320, target: rowB});
  assert.equal(rowB.classList.contains('is-hovered'), true);
  env.tracker.disconnect();
  assert.equal(rowB.classList.contains('is-hovered'), false);

  env.dispatchPointer('pointermove', {pointerType: 'mouse', clientX: 160, clientY: 330, target: rowB});
  assert.equal(rowB.classList.contains('is-hovered'), false);
});
