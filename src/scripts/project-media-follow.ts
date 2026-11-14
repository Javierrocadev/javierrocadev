export interface ProjectMediaFollowOptions {
  root: HTMLElement | Document;
  padding?: number;
  smoothing?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createProjectMediaFollow(options: ProjectMediaFollowOptions) {
  const {root, padding = 10, smoothing = 0.22} = options;
  const controller = new AbortController();
  const {signal} = controller;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let activeOverlay: HTMLElement | null = null;
  let activeCta: HTMLElement | null = null;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  let rafId = 0;

  function isFinePointer(event: PointerEvent): boolean {
    return event.pointerType === 'mouse' || event.pointerType === 'pen';
  }

  function applyTransform() {
    if (!activeCta) return;
    activeCta.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function reset() {
    stopLoop();
    activeCta?.style.removeProperty('transform');
    activeOverlay = null;
    activeCta = null;
    currentX = 0;
    currentY = 0;
    targetX = 0;
    targetY = 0;
  }

  function computeTarget(overlay: HTMLElement, cta: HTMLElement, clientX: number, clientY: number) {
    const rect = overlay.getBoundingClientRect();
    const overlayW = overlay.clientWidth || rect.width;
    const overlayH = overlay.clientHeight || rect.height;
    const ctaW = cta.offsetWidth || 0;
    const ctaH = cta.offsetHeight || 0;

    const maxX = Math.max(0, (overlayW - ctaW) / 2 - padding);
    const maxY = Math.max(0, (overlayH - ctaH) / 2 - padding);

    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);

    return {
      x: clamp(dx, -maxX, maxX),
      y: clamp(dy, -maxY, maxY),
    };
  }

  function step() {
    rafId = 0;
    if (!activeOverlay || !activeCta || motion.matches) return;

    currentX += (targetX - currentX) * smoothing;
    currentY += (targetY - currentY) * smoothing;

    if (Math.abs(targetX - currentX) < 0.15 && Math.abs(targetY - currentY) < 0.15) {
      currentX = targetX;
      currentY = targetY;
      applyTransform();
      return;
    }

    applyTransform();
    rafId = requestAnimationFrame(step);
  }

  function scheduleLoop() {
    if (!rafId) {
      rafId = requestAnimationFrame(step);
    }
  }

  function findOverlay(target: EventTarget | null): HTMLElement | null {
    if (!target || typeof (target as Element).closest !== 'function') return null;
    const overlay = (target as Element).closest<HTMLElement>('.project-media-overlay');
    if (!overlay || overlay.hidden || overlay.classList.contains('hidden')) return null;
    return overlay;
  }

  root.addEventListener(
    'pointerover',
    (rawEvent) => {
      const event = rawEvent as PointerEvent;
      if (!isFinePointer(event) || motion.matches) return;
      const overlay = findOverlay(event.target);
      if (!overlay || overlay === activeOverlay) return;
      const cta = overlay.querySelector<HTMLElement>('.project-media-cta');
      if (!cta) return;

      stopLoop();
      activeOverlay = overlay;
      activeCta = cta;
      const next = computeTarget(overlay, cta, event.clientX, event.clientY);
      currentX = next.x;
      currentY = next.y;
      targetX = next.x;
      targetY = next.y;
      applyTransform();
    },
    {passive: true, signal},
  );

  root.addEventListener(
    'pointermove',
    (rawEvent) => {
      const event = rawEvent as PointerEvent;
      if (!isFinePointer(event) || motion.matches) return;
      const overlay = findOverlay(event.target);
      if (!overlay) return;

      if (overlay !== activeOverlay || !activeCta) {
        const cta = overlay.querySelector<HTMLElement>('.project-media-cta');
        if (!cta) return;
        stopLoop();
        activeOverlay = overlay;
        activeCta = cta;
        const next = computeTarget(overlay, cta, event.clientX, event.clientY);
        currentX = next.x;
        currentY = next.y;
        targetX = next.x;
        targetY = next.y;
        applyTransform();
        return;
      }

      const next = computeTarget(overlay, activeCta, event.clientX, event.clientY);
      targetX = next.x;
      targetY = next.y;
      scheduleLoop();
    },
    {passive: true, signal},
  );

  root.addEventListener(
    'pointerout',
    (rawEvent) => {
      const event = rawEvent as PointerEvent;
      if (!activeOverlay) return;
      const related = event.relatedTarget as Node | null;
      if (related && activeOverlay.contains(related)) return;
      stopLoop();
      activeOverlay = null;
      activeCta = null;
    },
    {passive: true, signal},
  );

  root.addEventListener('touchstart', reset, {passive: true, signal});
  window.addEventListener('blur', reset, {signal});
  motion.addEventListener(
    'change',
    () => {
      if (motion.matches) reset();
    },
    {signal},
  );

  return {
    reset,
    disconnect() {
      controller.abort();
      reset();
    },
  };
}
