import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {waitForProjectMedia, createProjectMediaEntrance} from '../src/scripts/project-media-entry.ts';

function video() {
  return Object.assign(new EventTarget(), {tagName: 'VIDEO', readyState: 0, videoWidth: 0, videoHeight: 0, style: {}, poster: 'poster.webp'});
}

test('fits the native video ratio before reveal without cropping or letterboxing', async () => {
  const media = video();
  const controller = new AbortController();
  let resolved = false;
  const pending = waitForProjectMedia(media, {signal: controller.signal}).then((ready) => { resolved = true; return ready; });
  media.videoWidth = 1200;
  media.videoHeight = 700;
  media.readyState = 1;
  media.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(media.style.aspectRatio, '1200 / 700', 'Fit the box while it is still hidden');
  assert.equal(resolved, false, 'Metadata must not reveal a not-yet-decoded frame');
  media.readyState = 2;
  media.dispatchEvent(new Event('loadeddata'));
  assert.equal(await pending, true);
  const cached = video();
  Object.assign(cached, {readyState: 4, videoWidth: 900, videoHeight: 1200});
  assert.equal(await waitForProjectMedia(cached, {signal: controller.signal}), true);
  assert.equal(cached.style.aspectRatio, '900 / 1200', 'Already-loaded portrait media also fits');
});

test('video reveal waits for a decoded frame, not metadata or a poster', async () => {
  const media = video();
  const controller = new AbortController();
  let resolved = false;
  const pending = waitForProjectMedia(media, {signal: controller.signal}).then((ready) => { resolved = true; return ready; });
  media.readyState = 1;
  media.dispatchEvent(new Event('loadedmetadata'));
  await Promise.resolve();
  assert.equal(resolved, false);
  media.readyState = 2;
  media.dispatchEvent(new Event('loadeddata'));
  assert.equal(await pending, true);
});

test('image decoding and logo readiness share the media-ready contract', async () => {
  const signal = new AbortController().signal;
  let decoded;
  const image = Object.assign(new EventTarget(), {tagName: 'IMG', decode: () => new Promise((resolve) => { decoded = resolve; })});
  const pending = waitForProjectMedia(image, {signal});
  decoded();
  assert.equal(await pending, true);
  assert.equal(await waitForProjectMedia({tagName: 'DIV'}, {signal}), true);
});

test('failed, aborted and slow media settle without leaving the viewer hidden', async () => {
  const controller = new AbortController();
  const failed = video();
  const error = waitForProjectMedia(failed, {signal: controller.signal});
  failed.dispatchEvent(new Event('error'));
  assert.equal(await error, false);
  const pending = waitForProjectMedia(video(), {signal: controller.signal});
  controller.abort();
  assert.equal(await pending, false);
  assert.equal(await waitForProjectMedia(video(), {signal: controller.signal}), false);
  assert.equal(await waitForProjectMedia(video(), {signal: new AbortController().signal, timeoutMs: 1}), false);
});

test('reduced motion can show the static poster and controls after metadata', async () => {
  const media = video();
  const pending = waitForProjectMedia(media, {signal: new AbortController().signal, reducedMotion: true});
  media.readyState = 1;
  media.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(await pending, true);
});

test('initial entrance runs once after intersection and readiness; cancellation discards stale media', async (t) => {
  const originals = ['IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  let observer;
  const frames = new Map();
  let next = 1;
  Object.assign(globalThis, {
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observer = this; }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
    requestAnimationFrame(callback) { frames.set(next, callback); return next++; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const controller = new AbortController();
  const element = {dataset: {mediaEntry: 'pending'}};
  const media = video();
  let settled = 0;
  const entrance = createProjectMediaEntrance({element, getMedia: () => media, signal: controller.signal, onReady: () => settled++});
  observer.callback([{isIntersecting: false}]);
  assert.equal(frames.size, 0);
  observer.callback([{isIntersecting: true}]);
  assert.equal(element.dataset.mediaEntry, 'pending');
  media.readyState = 2;
  media.dispatchEvent(new Event('loadeddata'));
  await Promise.resolve();
  for (const callback of frames.values()) callback();
  frames.clear();
  assert.equal(element.dataset.mediaEntry, 'ready');
  assert.equal(settled, 1);
  assert.equal(observer.disconnected, true);
  entrance.cancel();
  const other = video();
  const stale = createProjectMediaEntrance({element, getMedia: () => other, signal: controller.signal, onReady: () => settled++});
  observer.callback([{isIntersecting: true}]);
  stale.cancel();
  other.dispatchEvent(new Event('loadeddata'));
  await Promise.resolve();
  assert.equal(frames.size, 0);
  assert.equal(element.dataset.mediaEntry, undefined);
  assert.equal(settled, 1);
  controller.abort();
});

test('home keeps video geometry flexible and gates the existing click fade on readiness', async () => {
  const source = await readFile(new URL('../src/components/Sections/MyProyects.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /target\.style\.aspectRatio\s*=/);
  assert.match(source, /createProjectMediaEntrance\(/);
  assert.match(source, /const ready = waitForProjectMedia\(videoEl[\s\S]*?await ready;/);
  assert.match(source, /data-media-entry="pending"/);
  assert.match(source, /prefers-reduced-motion/);
  assert.doesNotMatch(source, /#project-visual\s*\{\s*aspect-ratio:/);
  const videoTag = source.match(/<video\b[\s\S]*?\/>/)[0];
  assert.doesNotMatch(videoTag, /bg-primary\/10|object-cover/);
});
