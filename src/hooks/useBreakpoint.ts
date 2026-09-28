import { useMediaQuery } from './useMediaQuery';

/** Ab dieser Breite ist die Seitenleiste fix sichtbar (PLAN.md, «Responsives Layout»). */
export const DESKTOP_MIN_WIDTH = 1024;

/** `desktop` ≥ 1024 px (Seitenleiste fix), sonst `compact` (Seitenleiste als Drawer). */
export function useBreakpoint(): 'desktop' | 'compact' {
  return useMediaQuery(`(min-width: ${DESKTOP_MIN_WIDTH}px)`) ? 'desktop' : 'compact';
}
