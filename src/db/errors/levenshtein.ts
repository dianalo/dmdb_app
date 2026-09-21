/**
 * Levenshtein-Distanz und daraus abgeleitete Vorschläge («Meintest du «song»?»).
 * Bewusst 20 Zeilen selbst statt einer Abhängigkeit.
 */

/** Editierdistanz zweier Zeichenketten (Einfügen, Löschen, Ersetzen). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] as number) + 1,
        (previous[j] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] as number;
}

/**
 * Wie weit ein Vorschlag vom getippten Wort entfernt sein darf.
 * Kurze Wörter sind strenger, sonst schlagen wir «id» statt «is» vor.
 */
export function maxDistance(word: string): number {
  return word.length <= 4 ? 1 : 2;
}

/**
 * Der ähnlichste Kandidat oder `undefined`, wenn keiner nahe genug ist.
 * Verglichen wird ohne Rücksicht auf Gross- und Kleinschreibung,
 * zurückgegeben wird die Schreibweise des Kandidaten.
 */
export function closestMatch(word: string, candidates: Iterable<string>): string | undefined {
  const needle = word.toLowerCase();
  const limit = maxDistance(needle);
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate === word) return undefined; // Exakt gleich: kein Vorschlag nötig.
    const distance = levenshtein(needle, candidate.toLowerCase());
    if (distance <= limit && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
