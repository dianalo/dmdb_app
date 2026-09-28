/** Material Design Icon als inline SVG (Pfade aus `@mdi/js`), rein dekorativ. */
export function Icon({ path, size = 24 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" />
    </svg>
  );
}
