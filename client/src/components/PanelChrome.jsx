import { startPointerDrag } from '../hooks/usePanelLayout.js';

/**
 * Docked or floating panel chrome with move + edge resize handles.
 */
export default function PanelChrome({
  id,
  className = '',
  floating,
  position,
  width,
  height,
  onFloat,
  onDock,
  onMove,
  onResizeWidth,
  onResizeHeight,
  resizeEdge = null, // 'right' | 'left' | 'top'
  children,
}) {
  const style = floating
    ? {
        position: 'fixed',
        left: position?.x ?? 24,
        top: position?.y ?? 72,
        width: width || undefined,
        height: height || undefined,
        zIndex: 40,
        maxHeight: height ? undefined : '70vh',
      }
    : width
      ? { width, maxWidth: width, flex: '0 0 auto' }
      : height
        ? { height, maxHeight: height }
        : undefined;

  const beginMove = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Detach on first move drag if still docked
    if (!floating) {
      const rect = e.currentTarget.closest('.panel-chrome')?.getBoundingClientRect();
      onFloat?.({
        x: rect ? rect.left : e.clientX - 40,
        y: rect ? rect.top : e.clientY - 16,
      });
    }
    startPointerDrag({
      cursor: 'grabbing',
      onMove: (dx, dy) => onMove?.(dx, dy),
    });
  };

  const beginResize = (edge) => (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const cursor = edge === 'top' ? 'ns-resize' : 'ew-resize';
    startPointerDrag({
      cursor,
      onMove: (dx, dy) => {
        if (edge === 'right') onResizeWidth?.(dx);
        else if (edge === 'left') onResizeWidth?.(-dx);
        else if (edge === 'top') onResizeHeight?.(-dy);
      },
    });
  };

  return (
    <div
      className={`panel-chrome ${floating ? 'is-floating' : 'is-docked'} ${className}`}
      style={style}
      data-panel={id}
    >
      <div className="panel-toolbar">
        <button type="button" className="panel-drag-handle" onPointerDown={beginMove} title="Drag to move">
          ⋮⋮ Drag
        </button>
        {floating ? (
          <button type="button" className="ghost-btn panel-dock-btn" onClick={() => onDock?.()}>
            Dock
          </button>
        ) : null}
      </div>

      <div className="panel-chrome-body">{children}</div>

      {(resizeEdge === 'right' || floating) && onResizeWidth ? (
        <div
          className="panel-resize-handle edge-right"
          onPointerDown={beginResize('right')}
          title="Drag to resize"
        />
      ) : null}
      {(resizeEdge === 'left' || floating) && onResizeWidth ? (
        <div
          className="panel-resize-handle edge-left"
          onPointerDown={beginResize('left')}
          title="Drag to resize"
        />
      ) : null}
      {(resizeEdge === 'top' || floating) && onResizeHeight ? (
        <div
          className="panel-resize-handle edge-top"
          onPointerDown={beginResize('top')}
          title="Drag to resize height"
        />
      ) : null}
    </div>
  );
}
