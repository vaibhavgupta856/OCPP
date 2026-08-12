import { useCallback, useEffect, useState } from 'react';

const KEY = 'massive-simulator-panel-layout-v3';

const DEFAULTS = {
  leftWidth: 210,
  rightWidth: 270,
  traceHeight: 100,
  traceOpen: true,
  floats: {
    left: null,
    right: null,
    trace: null,
  },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw), floats: { ...DEFAULTS.floats, ...(JSON.parse(raw).floats || {}) } };
  } catch {
    return DEFAULTS;
  }
}

/** Persist left/right/trace sizes and optional floating positions. */
export function usePanelLayout() {
  const [layout, setLayout] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  }, [layout]);

  const setLeftWidth = useCallback((w) => {
    setLayout((prev) => ({
      ...prev,
      leftWidth: clamp(typeof w === 'function' ? w(prev.leftWidth) : w, 160, 420),
    }));
  }, []);

  const setRightWidth = useCallback((w) => {
    setLayout((prev) => ({
      ...prev,
      rightWidth: clamp(typeof w === 'function' ? w(prev.rightWidth) : w, 200, 480),
    }));
  }, []);

  const setTraceHeight = useCallback((h) => {
    setLayout((prev) => ({
      ...prev,
      traceHeight: clamp(
        typeof h === 'function' ? h(prev.traceHeight) : h,
        72,
        Math.round(window.innerHeight * 0.45)
      ),
    }));
  }, []);

  const setTraceOpen = useCallback((open) => {
    setLayout((prev) => ({ ...prev, traceOpen: typeof open === 'function' ? open(prev.traceOpen) : !!open }));
  }, []);

  const setFloat = useCallback((id, pos) => {
    setLayout((prev) => ({
      ...prev,
      floats: {
        ...prev.floats,
        [id]: typeof pos === 'function' ? pos(prev.floats[id]) : pos,
      },
    }));
  }, []);

  const moveFloat = useCallback((id, dx, dy) => {
    setLayout((prev) => {
      const cur = prev.floats[id] || { x: 24, y: 72 };
      return {
        ...prev,
        floats: {
          ...prev.floats,
          [id]: {
            ...cur,
            x: Math.max(0, Math.min(window.innerWidth - 120, cur.x + dx)),
            y: Math.max(0, Math.min(window.innerHeight - 80, cur.y + dy)),
          },
        },
      };
    });
  }, []);

  const dock = useCallback((id) => {
    setLayout((prev) => ({
      ...prev,
      floats: { ...prev.floats, [id]: null },
    }));
  }, []);

  return {
    layout,
    setLeftWidth,
    setRightWidth,
    setTraceHeight,
    setTraceOpen,
    setFloat,
    moveFloat,
    dock,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || min));
}

/**
 * Drag helper: pointer down on handle → move/resize until pointer up.
 * onMove(dx, dy, event) called each move; seed captured at start.
 */
export function startPointerDrag({ onMove, onEnd, cursor = 'grabbing' }) {
  const prevCursor = document.body.style.cursor;
  const prevSelect = document.body.style.userSelect;
  document.body.style.cursor = cursor;
  document.body.style.userSelect = 'none';

  let lastX = null;
  let lastY = null;

  const onPointerMove = (e) => {
    if (lastX == null) {
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    onMove?.(dx, dy, e);
  };

  const onPointerUp = (e) => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevSelect;
    onEnd?.(e);
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}
