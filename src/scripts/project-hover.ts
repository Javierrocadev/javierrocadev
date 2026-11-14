export interface ProjectHoverOptions {
  root: HTMLElement;
  onHoverChange?: (row: HTMLElement | null) => void;
}

const DOCUMENT_POSITION_PRECEDING = 2;

export function createProjectHoverTracker(options: ProjectHoverOptions) {
  const {root, onHoverChange} = options;
  const controller = new AbortController();
  const {signal} = controller;

  let lastX = 0;
  let lastY = 0;
  let hasPointer = false;
  let activeRow: HTMLElement | null = null;
  let rafId = 0;
  let lastScrollY = window.scrollY ?? 0;

  function isFinePointer(event: PointerEvent): boolean {
    return event.pointerType === 'mouse' || event.pointerType === 'pen';
  }

  function resolveValidRow(candidate: Element | null): HTMLElement | null {
    const row = candidate?.closest?.('[data-project-row]') as HTMLElement | null | undefined;
    if (!row || !row.isConnected || row.hidden || !root.contains(row)) {
      return null;
    }
    return row;
  }

  function setHoveredRow(nextRow: HTMLElement | null) {
    if (nextRow === activeRow) return;
    activeRow?.classList.remove('is-hovered');
    activeRow = nextRow;
    activeRow?.classList.add('is-hovered');
    onHoverChange?.(activeRow);
  }

  function clearPointer() {
    hasPointer = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    setHoveredRow(null);
  }

  function hitTestAtPointer(scrollDirection = 0) {
    if (!hasPointer) {
      setHoveredRow(null);
      return;
    }

    const hit = document.elementFromPoint(lastX, lastY);
    const nextRow = resolveValidRow(hit);

    // Collapsing an upper row during downward scroll pulls the row boundary upward;
    // avoid snapping hover back to an earlier row while scrolling downward.
    if (
      scrollDirection > 0 &&
      nextRow &&
      activeRow &&
      nextRow !== activeRow &&
      activeRow.isConnected &&
      !activeRow.hidden &&
      root.contains(activeRow) &&
      typeof activeRow.compareDocumentPosition === 'function' &&
      (activeRow.compareDocumentPosition(nextRow) & DOCUMENT_POSITION_PRECEDING) !== 0
    ) {
      return;
    }

    setHoveredRow(nextRow);
  }

  function updateFromPointerEvent(event: PointerEvent, requireCoordinateChange: boolean) {
    if (!isFinePointer(event)) return;
    if (requireCoordinateChange && hasPointer && event.clientX === lastX && event.clientY === lastY) {
      return;
    }

    lastX = event.clientX;
    lastY = event.clientY;
    hasPointer = true;
    lastScrollY = window.scrollY ?? 0;

    const target =
      event.target && typeof (event.target as Element).closest === 'function'
        ? (event.target as Element)
        : null;
    setHoveredRow(resolveValidRow(target));
  }

  function scheduleSync() {
    if (!hasPointer || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const currentScrollY = window.scrollY ?? 0;
      const direction = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;
      hitTestAtPointer(direction);
    });
  }

  document.addEventListener(
    'pointermove',
    (event) => updateFromPointerEvent(event as PointerEvent, false),
    {passive: true, signal},
  );
  document.addEventListener(
    'pointerover',
    (event) => updateFromPointerEvent(event as PointerEvent, true),
    {passive: true, signal},
  );
  document.addEventListener('pointerleave', clearPointer, {passive: true, signal});
  document.addEventListener('touchstart', clearPointer, {passive: true, signal});
  window.addEventListener('scroll', scheduleSync, {passive: true, signal});
  window.addEventListener('resize', scheduleSync, {passive: true, signal});
  window.addEventListener('blur', clearPointer, {signal});

  return {
    sync() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      lastScrollY = window.scrollY ?? 0;
      hitTestAtPointer(0);
    },
    disconnect() {
      controller.abort();
      clearPointer();
    },
  };
}
