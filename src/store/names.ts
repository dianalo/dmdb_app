/**
 * Reine Hilfsfunktionen für Namen von Datenbanken und Scratch-Books.
 */

/** Vergleichsschlüssel: getrimmt, ohne Gross-/Kleinschreibung. */
function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase('de-CH');
}

/** true, wenn `name` (getrimmt, ohne Gross-/Kleinschreibung) schon in `existing` vorkommt. */
export function isNameTaken(name: string, existing: readonly string[]): boolean {
  const key = nameKey(name);
  return existing.some((candidate) => nameKey(candidate) === key);
}

/** Macht `base` eindeutig: «Name», sonst «Name (2)», «Name (3)», … */
export function uniqueName(base: string, existing: readonly string[]): string {
  const trimmed = base.trim();
  if (!isNameTaken(trimmed, existing)) return trimmed;
  for (let n = 2; ; n += 1) {
    const candidate = `${trimmed} (${n})`;
    if (!isNameTaken(candidate, existing)) return candidate;
  }
}

/**
 * Name aus einem Dateinamen: ohne Pfad und ohne letzte Endung.
 * `Übung K4.sql` ergibt «Übung K4», `.sqlite` ergibt `fallback`.
 */
export function nameFromFilename(filename: string, fallback: string): string {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : dot === 0 ? '' : base).trim();
  return stem.length > 0 ? stem : fallback;
}
