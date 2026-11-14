interface MediaReadyOptions {
  signal: AbortSignal;
  reducedMotion?: boolean;
  timeoutMs?: number;
}

/** Wait for pixels, not just video dimensions, before revealing the viewer. */
export function waitForProjectMedia(media: HTMLElement, {signal, reducedMotion = false, timeoutMs = 8000}: MediaReadyOptions): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (media.tagName !== 'IMG' && media.tagName !== 'VIDEO') return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      media.removeEventListener('error', fail);
      media.removeEventListener('loadeddata', ready);
      media.removeEventListener('canplay', ready);
      media.removeEventListener('loadedmetadata', metadata);
      resolve(success);
    };
    const abort = () => finish(false);
    const fail = () => finish(false);
    const fitVideo = () => {
      if (media.tagName !== 'VIDEO') return;
      const video = media as HTMLVideoElement;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        video.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      }
    };
    const ready = () => { fitVideo(); finish(true); };
    const metadata = () => { fitVideo(); if (reducedMotion) finish(true); };
    const timeout = setTimeout(fail, timeoutMs);
    signal.addEventListener('abort', abort, {once: true});
    media.addEventListener('error', fail, {once: true});
    if (media.tagName === 'IMG') {
      void (media as HTMLImageElement).decode().then(ready, fail);
    } else {
      media.addEventListener('loadeddata', ready);
      media.addEventListener('canplay', ready);
      media.addEventListener('loadedmetadata', metadata);
      if ((media as HTMLVideoElement).readyState >= (reducedMotion ? 1 : 2)) ready();
    }
  });
}

interface EntranceOptions {
  element: HTMLElement;
  getMedia: () => HTMLElement;
  signal: AbortSignal;
  reducedMotion?: boolean;
  onPending?: (ready: Promise<boolean>) => void;
  onReady?: () => void;
}

export function createProjectMediaEntrance({element, getMedia, signal, reducedMotion, onPending, onReady}: EntranceOptions) {
  const controller = new AbortController();
  let started = false;
  let frame = 0;
  function cancel() {
    controller.abort();
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    delete element.dataset.mediaEntry;
    signal.removeEventListener('abort', cancel);
  }
  const observer = new IntersectionObserver((entries) => {
    if (started || controller.signal.aborted || !entries.some((entry) => entry.isIntersecting)) return;
    started = true;
    observer.disconnect();
    const ready = waitForProjectMedia(getMedia(), {signal: controller.signal, reducedMotion});
    onPending?.(ready);
    void ready.then(() => {
      if (controller.signal.aborted) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (controller.signal.aborted) return;
        element.dataset.mediaEntry = 'ready';
        onReady?.();
      });
    });
  }, {threshold: 0.1});
  if (signal.aborted) cancel();
  else {
    signal.addEventListener('abort', cancel, {once: true});
    observer.observe(element);
  }
  return {cancel};
}
