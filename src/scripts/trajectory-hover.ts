interface TrajectoryHighlightOptions {
  container: HTMLElement;
  highlight: HTMLElement;
}

export function createTrajectoryHighlight({container, highlight}: TrajectoryHighlightOptions) {
  const controller = new AbortController();
  const {signal} = controller;
  let pointer: {x: number; y: number} | null = null;
  let frame = 0;

  function clear() {
    pointer = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    highlight.style.opacity = '0';
  }

  function update() {
    frame = 0;
    if (!pointer) return;
    const hit = document.elementFromPoint(pointer.x, pointer.y);
    const row = hit?.closest<HTMLElement>('.trajectory-item');
    if (!row || !row.isConnected || row.hidden || !container.contains(row)) {
      highlight.style.opacity = '0';
      return;
    }
    const rowRect = row.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    highlight.style.top = `${rowRect.top - containerRect.top}px`;
    highlight.style.height = `${rowRect.height}px`;
    highlight.style.opacity = '1';
  }

  function schedule() {
    if (pointer && !frame) frame = requestAnimationFrame(update);
  }

  function track(event: Event) {
    const e = event as PointerEvent;
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    pointer = {x: e.clientX, y: e.clientY};
    schedule();
  }

  document.addEventListener('pointermove', track, {passive: true, signal});
  document.addEventListener('pointerover', track, {passive: true, signal});
  document.addEventListener('pointerleave', clear, {passive: true, signal});
  document.addEventListener('touchstart', clear, {passive: true, signal});
  window.addEventListener('scroll', schedule, {passive: true, signal});
  window.addEventListener('resize', schedule, {passive: true, signal});
  window.addEventListener('blur', clear, {signal});

  return {
    disconnect() {
      controller.abort();
      clear();
    },
  };
}
