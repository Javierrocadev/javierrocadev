export interface ProjectVideosOptions {
  maxConcurrent?: number;
}

interface VideoState {
  visible: boolean;
  ratio: number;
  lastActivatedAt: number;
  onReady: () => void;
}

/** Keep fetching near the viewport separate from playback inside it. */
export function createProjectVideos(options: ProjectVideosOptions = {}) {
  const maxConcurrent = options.maxConcurrent ?? Infinity;
  const controller = new AbortController();
  const videos = new Map<HTMLVideoElement, VideoState>();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activationSeq = 0;
  const isRendered = (video: HTMLVideoElement) =>
    video.isConnected && !video.closest('[hidden]') && video.getClientRects().length > 0;

  function canPlay(video: HTMLVideoElement, state: VideoState) {
    return state.visible && isRendered(video) && !document.hidden && !motion.matches && Boolean(video.getAttribute('src'));
  }

  function syncAllPlayback() {
    const eligible: Array<{video: HTMLVideoElement; state: VideoState}> = [];
    for (const [video, state] of videos) {
      if (canPlay(video, state)) {
        eligible.push({video, state});
      } else {
        video.pause();
      }
    }

    if (eligible.length > maxConcurrent) {
      eligible.sort((a, b) =>
        (b.state.lastActivatedAt - a.state.lastActivatedAt) || (b.state.ratio - a.state.ratio));
    }

    eligible.forEach(({video}, index) => {
      if (index < maxConcurrent) {
        if (video.preload !== 'auto') video.preload = 'auto';
        video.muted = true;
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  function hydrate(video: HTMLVideoElement) {
    const src = video.dataset.src;
    if (!src || !isRendered(video) || video.getAttribute('src') === src) return;
    video.src = src;
    video.preload = 'metadata';
    video.load();
  }

  const loadObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target as HTMLVideoElement;
      if (entry.isIntersecting && videos.has(video) && isRendered(video)) {
        hydrate(video);
        loadObserver.unobserve(video);
      }
    }
  }, {rootMargin: '300px 0px'});

  const playbackObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target as HTMLVideoElement;
      const state = videos.get(video);
      if (!state) continue;
      state.visible = entry.isIntersecting && entry.intersectionRatio > 0;
      state.ratio = entry.intersectionRatio;
      if (state.visible) hydrate(video);
    }
    syncAllPlayback();
  });

  function release(video: HTMLVideoElement) {
    if (!video.getAttribute('src')) return;
    video.pause();
    video.removeAttribute('src');
    video.preload = 'none';
    video.load();
  }

  const evictObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target as HTMLVideoElement;
      const state = videos.get(video);
      if (!state) continue;
      if (!entry.isIntersecting && !state.visible && video.getAttribute('src')) {
        release(video);
        if (isRendered(video)) loadObserver.observe(video);
      }
    }
  }, {rootMargin: '600px 0px'});

  function observe(video: HTMLVideoElement) {
    if (controller.signal.aborted || videos.has(video) || !video.dataset.src) return;
    video.muted = true;
    video.defaultMuted = true;
    video.controls = motion.matches;
    const onReady = () => syncAllPlayback();
    videos.set(video, {visible: false, ratio: 0, lastActivatedAt: 0, onReady});
    video.addEventListener('canplay', onReady);
    loadObserver.observe(video);
    playbackObserver.observe(video);
    evictObserver.observe(video);
  }

  function prioritize(video: HTMLVideoElement) {
    const state = videos.get(video);
    if (!state) return;
    state.lastActivatedAt = ++activationSeq;
    if (state.visible) syncAllPlayback();
  }

  function unobserve(video: HTMLVideoElement) {
    const state = videos.get(video);
    if (state) video.removeEventListener('canplay', state.onReady);
    videos.delete(video);
    loadObserver.unobserve(video);
    playbackObserver.unobserve(video);
    evictObserver.unobserve(video);
    video.pause();
  }

  // Filters can move an already-visible row offscreen. Discard stale visibility
  // and ask both observers for fresh geometry instead of playing it immediately.
  function refresh() {
    for (const video of Array.from(videos.keys())) {
      unobserve(video);
      observe(video);
    }
  }

  document.addEventListener('visibilitychange', () => {
    syncAllPlayback();
  }, {signal: controller.signal});
  motion.addEventListener('change', () => {
    for (const video of videos.keys()) {
      video.controls = motion.matches;
    }
    syncAllPlayback();
  }, {signal: controller.signal});

  return {
    observe,
    prioritize,
    unobserve,
    refresh,
    disconnect() {
      controller.abort();
      for (const video of videos.keys()) unobserve(video);
      loadObserver.disconnect();
      playbackObserver.disconnect();
      evictObserver.disconnect();
    },
  };
}
