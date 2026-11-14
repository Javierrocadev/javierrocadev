export function easeInOutElastic(x: number): number {
  const c5 = (2 * Math.PI) / 4.5;

  return x <= 0
    ? 0
    : x >= 1
    ? 1
    : x < 0.5
    ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
    : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
}

function easeInOutCubic(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutSine(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

interface RowBox {
  height: number;
  paddingTop: number;
  paddingBottom: number;
  borderTopWidth: number;
  opacity: number;
}

interface ActiveTransition {
  element: HTMLElement;
  entering: boolean;
  from: RowBox;
  to: RowBox;
}

export interface ProjectRowVisibilityItem {
  element: HTMLElement;
  visible: boolean;
}

export interface ProjectRowAnimatorOptions {
  durationMs?: number;
  onStart?: (items: ProjectRowVisibilityItem[]) => void;
  onComplete?: () => void;
}

const INLINE_PROPS = [
  'height',
  'padding-top',
  'padding-bottom',
  'border-top-width',
  'opacity',
  'transform',
  'transform-origin',
  'overflow',
  'transition',
  'will-change',
] as const;

function clearInlineStyles(element: HTMLElement) {
  for (const prop of INLINE_PROPS) {
    element.style.removeProperty(prop);
  }
}

function readCurrentBox(element: HTMLElement): RowBox {
  const styles = getComputedStyle(element);
  return {
    height: element.getBoundingClientRect().height,
    paddingTop: parseFloat(styles.paddingTop) || 0,
    paddingBottom: parseFloat(styles.paddingBottom) || 0,
    borderTopWidth: parseFloat(styles.borderTopWidth) || 0,
    opacity: parseFloat(styles.opacity) || 0,
  };
}

function applyFrame(transition: ActiveTransition, progress: number) {
  const {element, entering, from, to} = transition;
  const smoothLayout = easeInOutCubic(progress);
  const smoothOpacity = easeInOutSine(progress);
  const softElastic = smoothLayout * 0.55 + easeInOutElastic(progress) * 0.45;
  const lerpLayout = (a: number, b: number) => Math.max(0, a + (b - a) * smoothLayout);

  element.style.height = `${lerpLayout(from.height, to.height)}px`;
  element.style.paddingTop = `${lerpLayout(from.paddingTop, to.paddingTop)}px`;
  element.style.paddingBottom = `${lerpLayout(from.paddingBottom, to.paddingBottom)}px`;
  element.style.borderTopWidth = `${lerpLayout(from.borderTopWidth, to.borderTopWidth)}px`;

  const clampedOpacity = Math.min(1, Math.max(0, from.opacity + (to.opacity - from.opacity) * smoothOpacity));
  element.style.opacity = String(clampedOpacity);

  const offsetY = entering ? (1 - softElastic) * 10 : softElastic * -8;
  const scale = entering ? 0.99 + 0.01 * softElastic : 1 - 0.008 * softElastic;
  element.style.transform = `translate3d(0, ${offsetY}px, 0) scale(${scale})`;
}

export function createProjectRowAnimator(options: ProjectRowAnimatorOptions = {}) {
  const durationMs = options.durationMs ?? 900;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId = 0;
  let activeTransitions: ActiveTransition[] = [];

  function cancelActive() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    for (const transition of activeTransitions) {
      clearInlineStyles(transition.element);
      if (!transition.entering) {
        transition.element.hidden = true;
      }
    }
    activeTransitions = [];
  }

  function applyVisibility(items: ProjectRowVisibilityItem[], {animate = true} = {}) {
    const useMotion = animate && !motion.matches;

    if (!useMotion) {
      cancelActive();
      for (const {element, visible} of items) {
        clearInlineStyles(element);
        element.hidden = !visible;
      }
      options.onStart?.(items);
      options.onComplete?.();
      return;
    }

    // Stop pending loop while keeping current visual geometry of active elements.
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    const previousByElement = new Map(activeTransitions.map((t) => [t.element, t]));
    activeTransitions = [];

    const transitions: ActiveTransition[] = [];

    for (const {element, visible} of items) {
      const prev = previousByElement.get(element);
      const isHidden = element.hidden;

      if (visible) {
        if (!isHidden && !prev) continue;
        const from: RowBox = isHidden
          ? {height: 0, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0, opacity: 0}
          : readCurrentBox(element);

        element.hidden = false;
        clearInlineStyles(element);
        const to = readCurrentBox(element);
        to.opacity = 1;

        const transition: ActiveTransition = {element, entering: true, from, to};
        element.style.overflow = 'hidden';
        element.style.transition = 'none';
        element.style.setProperty('transform-origin', 'center top');
        element.style.willChange = 'height, opacity, transform';
        applyFrame(transition, 0);
        transitions.push(transition);
      } else {
        if (isHidden) {
          clearInlineStyles(element);
          continue;
        }
        const from = readCurrentBox(element);
        const to: RowBox = {height: 0, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0, opacity: 0};

        const transition: ActiveTransition = {element, entering: false, from, to};
        element.style.overflow = 'hidden';
        element.style.transition = 'none';
        element.style.setProperty('transform-origin', 'center top');
        element.style.willChange = 'height, opacity, transform';
        applyFrame(transition, 0);
        transitions.push(transition);
      }
    }

    // Any row not part of transitions should have clean styles.
    const transitioningSet = new Set(transitions.map((t) => t.element));
    for (const {element, visible} of items) {
      if (!transitioningSet.has(element)) {
        clearInlineStyles(element);
        element.hidden = !visible;
      }
    }

    options.onStart?.(items);

    if (transitions.length === 0) {
      options.onComplete?.();
      return;
    }

    activeTransitions = transitions;
    let startTime = 0;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min(1, (timestamp - startTime) / durationMs);

      for (const transition of activeTransitions) {
        applyFrame(transition, progress);
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
        return;
      }

      rafId = 0;
      const completed = activeTransitions;
      activeTransitions = [];
      for (const transition of completed) {
        clearInlineStyles(transition.element);
        if (!transition.entering) {
          transition.element.hidden = true;
        }
      }
      options.onComplete?.();
    };

    rafId = requestAnimationFrame(step);
  }

  return {
    applyVisibility,
    disconnect() {
      cancelActive();
    },
  };
}
