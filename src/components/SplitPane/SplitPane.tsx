import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { de } from '@/i18n/de';
import { MAX_SPLIT_RATIO, MIN_SPLIT_RATIO, clampRatio } from '@/store/uiStore';
import styles from './SplitPane.module.css';

const DRAG_THRESHOLD_PX = 4;
const KEY_STEP = 0.05;

interface SplitPaneProps {
  /** Anteil des oberen Bereichs (0 bis 1). */
  ratio: number;
  /** Oberer Bereich eingeklappt, unterer maximiert. */
  maximized: boolean;
  onRatioChange(ratio: number): void;
  onToggleMaximized(): void;
  top: ReactNode;
  bottom: ReactNode;
}

interface DragState {
  pointerId: number;
  startY: number;
  moved: boolean;
}

/**
 * Horizontal geteilter Bereich (oben/unten) mit Griff.
 * Pointer Events funktionieren mit Maus, Finger und Stift; ein Tipp (ohne Ziehen)
 * auf den Griff maximiert die Ausgabe bzw. stellt sie zurück, weil präzises Ziehen
 * auf Touch mühsam ist. Bewusst kein Doppeltipp: der wäre schwer zu entdecken.
 */
export function SplitPane({
  ratio,
  maximized,
  onRatioChange,
  onToggleMaximized,
  top,
  bottom,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  // Während des Ziehens nur lokal rendern, erst beim Loslassen in den Store schreiben.
  const [liveRatio, setLiveRatio] = useState<number | null>(null);

  const shown = maximized ? 0 : (liveRatio ?? ratio);

  const ratioAt = (clientY: number): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return ratio;
    return clampRatio((clientY - rect.top) / rect.height);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startY: event.clientY, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (!state.moved && Math.abs(event.clientY - state.startY) < DRAG_THRESHOLD_PX) return;
    state.moved = true;
    setLiveRatio(ratioAt(event.clientY));
  };

  const finish = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (state.moved) {
      if (!cancelled) onRatioChange(ratioAt(event.clientY));
      setLiveRatio(null);
      return;
    }
    if (!cancelled) onToggleMaximized();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = maximized ? MIN_SPLIT_RATIO : ratio;
    let next: number | null = null;
    if (event.key === 'ArrowUp') next = base - KEY_STEP;
    else if (event.key === 'ArrowDown') next = base + KEY_STEP;
    else if (event.key === 'Home') next = MIN_SPLIT_RATIO;
    else if (event.key === 'End') next = MAX_SPLIT_RATIO;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleMaximized();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    onRatioChange(clampRatio(next));
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={styles.top}
        style={{ flexBasis: `${shown * 100}%` }}
        data-collapsed={maximized || undefined}
      >
        {top}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={de.splitPane.handleLabel}
        aria-description={de.splitPane.handleHint}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown * 100)}
        tabIndex={0}
        title={de.splitPane.handleHint}
        className={styles.handle}
        data-dragging={liveRatio !== null || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, false)}
        onPointerCancel={(event) => finish(event, true)}
        onKeyDown={onKeyDown}
      />
      <div className={styles.bottom}>{bottom}</div>
    </div>
  );
}
