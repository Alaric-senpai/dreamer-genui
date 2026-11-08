/**
 * Shared vitest setup: jsdom lacks `matchMedia`, which motion's
 * `useReducedMotion` requires. Provide a controllable stub.
 */
type ChangeListener = (event: { matches: boolean }) => void;

interface MediaQueryStub {
  matches: boolean;
  media: string;
  onchange: unknown;
  addEventListener: (type: string, fn: ChangeListener) => void;
  removeEventListener: (type: string, fn: ChangeListener) => void;
  addListener: (fn: ChangeListener) => void;
  removeListener: (fn: ChangeListener) => void;
  dispatchEvent: () => boolean;
}

let reducedMotion = false;

/** Listener callbacks registered by libraries subscribed to the media query. */
const queryListeners = new Set<ChangeListener>();

export function setReducedMotion(value: boolean): void {
  reducedMotion = value;
  for (const fn of queryListeners) fn({ matches: value });
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryStub => ({
      // Getter: re-evaluated on every access, so notifications revert correctly.
      get matches() {
        return query.includes('prefers-reduced-motion') ? reducedMotion : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, fn: ChangeListener) => {
        queryListeners.add(fn);
      },
      removeEventListener: (_type: string, fn: ChangeListener) => {
        queryListeners.delete(fn);
      },
      addListener: (fn: ChangeListener) => {
        queryListeners.add(fn);
      },
      removeListener: (fn: ChangeListener) => {
        queryListeners.delete(fn);
      },
      dispatchEvent: () => false,
    }),
  });
}
