import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createProjectVideos} from '../src/scripts/project-videos.ts';
import {getVideoPoster} from '../src/lib/video-poster.ts';

const components = ['MyProyects', 'ProjectList'].map((name) =>
  readFileSync(new URL(`../src/components/Sections/${name}.astro`, import.meta.url), 'utf8'));

test('project videos defer their source and reserve a stable media box', () => {
  for (const source of components) {
    const video = source.match(/<video\b[\s\S]*?\/>/)[0];
    assert.match(video, /data-src=/);
    assert.doesNotMatch(video, /\s(?:src=|autoplay\b)/);
    assert.match(video, /preload="none"/);
    assert.match(video, /width="1280"/);
    assert.match(video, /height="720"/);
    assert.match(video, /muted/);
    assert.match(video, /loop/);
    assert.match(video, /playsinline/);
  }
});

test('both views use the visibility controller and release it during navigation', () => {
  for (const source of components) {
    assert.match(source, /createProjectVideos/);
    assert.match(source, /videos\.disconnect\(\)/);
  }
  assert.match(components[0], /videos\.unobserve\(videoEl\)/);
  assert.match(components[0], /videos\.observe\(videoEl\)/);
  assert.match(components[1], /videos\.refresh\(\)/);
});

class Video extends EventTarget {
  dataset = {src: 'https://cdn.example.com/demo.mp4'};
  isConnected = true;
  hidden = false;
  rendered = true;
  src = '';
  loads = 0;
  plays = 0;
  pauses = 0;
  getAttribute(name) { return this[name] || null; }
  removeAttribute(name) { this[name] = ''; }
  closest() { return this.hidden ? {} : null; }
  getClientRects() { return this.rendered ? [{}] : []; }
  load() { this.loads++; }
  play() { this.plays++; return Promise.resolve(); }
  pause() { this.pauses++; }
}

function setup(t, options) {
  const observers = [];
  class Observer {
    targets = new Set();
    constructor(callback, observerOptions) {
      this.callback = callback;
      this.options = observerOptions;
      observers.push(this);
    }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
    emit(target, visible) {
      this.callback([{target, isIntersecting: visible, intersectionRatio: visible ? 0.5 : 0}]);
    }
  }
  const document = new EventTarget();
  document.hidden = false;
  const motion = new EventTarget();
  motion.matches = false;
  const originals = new Map(['document', 'window', 'IntersectionObserver'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, {document, window: {matchMedia: () => motion}, IntersectionObserver: Observer});
  const controller = createProjectVideos(options);
  t.after(() => {
    controller.disconnect();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {controller, load: observers[0], playback: observers[1], evict: observers[2], document, motion};
}

test('preloads once at 300px but plays only in the viewport and pauses on exit', (t) => {
  const {controller, load, playback} = setup(t);
  const video = new Video();
  controller.observe(video);
  assert.equal(video.src, '');
  assert.equal(video.loads, 0);
  assert.equal(video.plays, 0);
  assert.equal(load.options.rootMargin, '300px 0px');
  load.emit(video, true);
  assert.equal(video.src, video.dataset.src);
  assert.equal(video.loads, 1);
  video.dispatchEvent(new Event('canplay'));
  assert.equal(video.plays, 0);
  playback.emit(video, true);
  assert.equal(video.plays, 1);
  assert.equal(video.muted, true);
  assert.equal(video.defaultMuted, true);
  playback.emit(video, false);
  assert.equal(video.pauses, 2);
  video.dispatchEvent(new Event('canplay'));
  assert.equal(video.plays, 1);
  playback.emit(video, true);
  assert.equal(video.loads, 1);
  assert.equal(video.plays, 2);
});

test('filter refresh invalidates visibility and hidden rows cannot load or play', (t) => {
  const {controller, load, playback} = setup(t);
  const video = new Video();
  controller.observe(video);
  video.hidden = true;
  controller.refresh();
  load.emit(video, true);
  playback.emit(video, true);
  assert.equal(video.loads, 0);
  assert.equal(video.plays, 0);
  video.hidden = false;
  controller.refresh();
  video.dispatchEvent(new Event('canplay'));
  assert.equal(video.plays, 0);
  playback.emit(video, true);
  assert.equal(video.plays, 1);
  controller.refresh();
  video.dispatchEvent(new Event('canplay'));
  assert.equal(video.plays, 1);
});

test('switching projects and navigation discard old media callbacks', (t) => {
  const {controller, load, playback, document} = setup(t);
  const oldVideo = new Video();
  controller.observe(oldVideo);
  playback.emit(oldVideo, true);
  controller.unobserve(oldVideo);
  oldVideo.dispatchEvent(new Event('canplay'));
  playback.emit(oldVideo, true);
  assert.equal(oldVideo.plays, 1);
  assert.equal(load.targets.has(oldVideo), false);
  const nextVideo = new Video();
  controller.observe(nextVideo);
  assert.equal(nextVideo.loads, 0);
  controller.disconnect();
  load.emit(nextVideo, true);
  playback.emit(nextVideo, true);
  document.dispatchEvent(new Event('visibilitychange'));
  nextVideo.dispatchEvent(new Event('canplay'));
  assert.equal(nextVideo.loads, 0);
  assert.equal(nextVideo.plays, 0);
  assert.equal(load.targets.size, 0);
  assert.equal(playback.targets.size, 0);
});

test('background tabs pause; reduced motion allows manual playback without autoplay', (t) => {
  const {controller, playback, document, motion} = setup(t);
  const video = new Video();
  motion.matches = true;
  controller.observe(video);
  playback.emit(video, true);
  assert.equal(video.controls, true);
  assert.equal(video.plays, 0);
  motion.matches = false;
  motion.dispatchEvent(new Event('change'));
  assert.equal(video.controls, false);
  assert.equal(video.plays, 1);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  video.dispatchEvent(new Event('canplay'));
  assert.equal(video.plays, 1);
  assert.ok(video.pauses > 0);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(video.plays, 2);
});

test('missing video URLs stay unloaded and rejected autoplay does not escape', async (t) => {
  const {controller, playback} = setup(t);
  const missing = new Video();
  delete missing.dataset.src;
  controller.observe(missing);
  playback.emit(missing, true);
  assert.equal(missing.loads, 0);
  const video = new Video();
  video.play = () => Promise.reject(new Error('Autoplay blocked'));
  controller.observe(video);
  playback.emit(video, true);
  await new Promise((resolve) => setImmediate(resolve));
});

test('posters use bounded Sanity transformations without altering original image URLs', () => {
  const src = 'https://cdn.sanity.io/images/project/production/cover-1920x1080.png?rect=0,0,100,100';
  const poster = new URL(getVideoPoster(src));
  assert.equal(poster.searchParams.get('auto'), 'format');
  assert.equal(poster.searchParams.get('w'), '1200');
  assert.equal(poster.searchParams.get('q'), '75');
  assert.equal(poster.searchParams.get('fit'), 'max');
  assert.equal(poster.searchParams.get('rect'), '0,0,100,100');
  assert.equal(getVideoPoster(), undefined);
  assert.equal(getVideoPoster('https://example.com/cover.png'), 'https://example.com/cover.png');
  assert.ok(!src.includes('auto='));
});

test('maxConcurrent caps simultaneously playing videos and prioritize promotes hovered video', (t) => {
  const {controller, playback} = setup(t, {maxConcurrent: 2});
  const v1 = new Video();
  const v2 = new Video();
  const v3 = new Video();

  controller.observe(v1);
  controller.observe(v2);
  controller.observe(v3);

  playback.callback([
    {target: v1, isIntersecting: true, intersectionRatio: 0.9},
    {target: v2, isIntersecting: true, intersectionRatio: 0.8},
    {target: v3, isIntersecting: true, intersectionRatio: 0.3},
  ]);

  assert.equal(v1.plays, 1);
  assert.equal(v2.plays, 1);
  assert.equal(v3.plays, 0);
  assert.equal(v3.pauses, 1);

  controller.prioritize(v3);
  assert.equal(v3.plays, 1);
  assert.equal(v2.pauses, 1);
});

test('project list allows three visible videos and keeps a fourth paused', (t) => {
  const match = components[1].match(/maxConcurrent: mobileViewport\.matches \? 1 : (\d+)/);
  assert.ok(match, 'Project list must declare its playback limit');
  assert.equal(Number(match[1]), 3);
  const {controller, playback} = setup(t, {maxConcurrent: Number(match[1])});
  const videos = Array.from({length: 4}, () => new Video());
  videos.forEach(video => controller.observe(video));
  playback.callback(videos.map((target, index) => ({
    target, isIntersecting: true, intersectionRatio: 1 - index / 10,
  })));
  assert.deepEqual(videos.map(video => video.plays), [1, 1, 1, 0]);
  assert.equal(videos[3].pauses, 1);
  playback.emit(videos[0], false);
  assert.equal(videos[0].pauses, 1);
  assert.equal(videos[3].plays, 1);
});

test('project list switches between one mobile video and three desktop videos without leaking listeners', () => {
  const block = components[1].match(/const mobileViewport = [\s\S]*?(?=    const frameBindings)/)?.[0];
  assert.ok(block, 'Responsive playback configuration must be present');
  for (const initiallyMobile of [true, false]) {
    const viewport = new EventTarget();
    viewport.matches = initiallyMobile;
    const page = new AbortController();
    const created = [];
    const media = [{id: 'first'}, {id: 'second'}];
    const getCurrent = new Function('window', 'createProjectVideos', 'root', 'controller', `${block}; return () => videos;`)(
      {matchMedia(query) { assert.equal(query, '(max-width: 767px)'); return viewport; }},
      options => {
        const instance = {limit: options.maxConcurrent, disconnected: false, observed: [],
          disconnect() { this.disconnected = true; },
          observe(video) { this.observed.push(video); },
        };
        created.push(instance);
        return instance;
      },
      {querySelectorAll(selector) { assert.equal(selector, 'video'); return media; }},
      page,
    );
    assert.equal(getCurrent().limit, initiallyMobile ? 1 : 3);
    viewport.matches = !initiallyMobile;
    viewport.dispatchEvent(new Event('change'));
    assert.equal(created[0].disconnected, true);
    assert.equal(getCurrent().limit, initiallyMobile ? 3 : 1);
    assert.deepEqual(getCurrent().observed, media);
    viewport.matches = initiallyMobile;
    viewport.dispatchEvent(new Event('change'));
    assert.equal(created[1].disconnected, true);
    assert.equal(getCurrent().limit, initiallyMobile ? 1 : 3);
    page.abort();
    viewport.dispatchEvent(new Event('change'));
    assert.equal(created.length, 3);
    getCurrent().disconnect();
  }
});

test('evicts far-offscreen videos to release decoder memory and rehydrates on return', (t) => {
  const {controller, load, playback, evict} = setup(t, {maxConcurrent: 1});
  const v = new Video();
  controller.observe(v);

  assert.equal(evict.options.rootMargin, '600px 0px');
  load.emit(v, true);
  playback.emit(v, true);
  assert.equal(v.src, v.dataset.src);
  assert.equal(v.plays, 1);

  playback.emit(v, false);
  evict.emit(v, false);
  assert.equal(v.src, '');
  assert.equal(v.preload, 'none');
  assert.equal(load.targets.has(v), true);

  load.emit(v, true);
  playback.emit(v, true);
  assert.equal(v.src, v.dataset.src);
  assert.equal(v.plays, 2);
});
