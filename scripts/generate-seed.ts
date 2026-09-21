/**
 * Generator für die Beispieldatenbank «Musik-Streaming» der LPU
 * «Datenmodellierung und Datenbanken».
 *
 * Das Ergebnis wird als `src/seeds/musik_streaming.sql` eingecheckt, damit
 * «Zurücksetzen» auf jedem Gerät exakt dieselben Daten liefert. Der Generator
 * benutzt ausschliesslich einen eigenen PRNG (mulberry32) mit festem Startwert,
 * nie `Math.random()`, und ist deshalb reproduzierbar.
 *
 * Aufruf: `npm run seed`
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fester Startwert des PRNG. Ändern heisst: alle Daten ändern sich. */
export const GENERATOR_SEED = 20260921;

/** Muss zu `version` in `src/seeds/index.ts` passen. */
export const SEED_VERSION = 1;

/** Spätestes Datum, das in den Daten vorkommt. */
const HEUTE = '2025-09-20';

/** Zeilen pro Multi-Row-INSERT. */
const CHUNK = 50;

const MS_PRO_TAG = 86_400_000;

// ---------------------------------------------------------------------------
// PRNG und kleine Helfer
// ---------------------------------------------------------------------------

/** mulberry32: kurz, schnell, deterministisch über alle Node-Versionen. */
export function mulberry32(startwert: number): () => number {
  let a = startwert >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Zufall = () => number;

function ganzzahl(rnd: Zufall, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

function waehle<T>(rnd: Zufall, liste: readonly T[]): T {
  return liste[Math.floor(rnd() * liste.length)] as T;
}

function waehleGewichtet<T>(rnd: Zufall, liste: readonly (readonly [T, number])[]): T {
  const summe = liste.reduce((s, [, g]) => s + g, 0);
  let ziel = rnd() * summe;
  for (const [wert, gewicht] of liste) {
    ziel -= gewicht;
    if (ziel < 0) return wert;
  }
  return liste[liste.length - 1]![0];
}

function tagNummer(iso: string): number {
  return (
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) /
    MS_PRO_TAG
  );
}

function isoDatum(tag: number): string {
  return new Date(tag * MS_PRO_TAG).toISOString().slice(0, 10);
}

/** Das spätere der beiden ISO-Daten. */
function maxDatum(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Zufälliges ISO-Datum im Bereich [von, bis], Grenzen eingeschlossen. */
function datumZwischen(rnd: Zufall, von: string, bis: string): string {
  const a = tagNummer(von);
  const b = Math.max(a, tagNummer(bis));
  return isoDatum(ganzzahl(rnd, a, b));
}

// ---------------------------------------------------------------------------
// Wortpools (alles frei erfunden, keine echten Künstler:innen oder Titel)
// ---------------------------------------------------------------------------

const LAENDER: readonly (readonly [string, number])[] = [
  ['Schweiz', 30],
  ['Deutschland', 24],
  ['Österreich', 9],
  ['USA', 12],
  ['UK', 10],
  ['Frankreich', 8],
  ['Italien', 7],
];

const GENRE_NAMEN = [
  'Pop',
  'Rock',
  'Hip-Hop',
  'Elektro',
  'Jazz',
  'Klassik',
  'Indie',
  'Schlager',
  'Mundart',
] as const;

const ADJ_PLURAL = [
  'Späte',
  'Stille',
  'Wilde',
  'Letzte',
  'Blaue',
  'Graue',
  'Ferne',
  'Leise',
  'Kalte',
  'Goldene',
  'Halbe',
  'Freie',
] as const;

const NOMEN_PLURAL = [
  'Züge',
  'Gassen',
  'Wellen',
  'Nächte',
  'Signale',
  'Spiegel',
  'Gärten',
  'Anker',
  'Fenster',
  'Schatten',
  'Kometen',
  'Brücken',
  'Zeilen',
  'Wolken',
  'Gleise',
  'Träume',
  'Mauern',
  'Lichter',
] as const;

const WORT_VORNE = [
  'Nord',
  'Süd',
  'Morgen',
  'Abend',
  'Nacht',
  'Winter',
  'Sommer',
  'Fern',
  'Hall',
  'Stein',
  'Berg',
  'Föhn',
  'Züri',
  'Neben',
  'Ufer',
  'Alpen',
] as const;

const WORT_HINTEN = [
  'licht',
  'klang',
  'sturm',
  'wind',
  'feuer',
  'schatten',
  'welle',
  'funke',
  'rausch',
  'hafen',
  'garten',
  'strom',
  'fahrt',
  'lied',
  'tanz',
  'traum',
] as const;

const ENG_ADJ = [
  'Velvet',
  'Silent',
  'Golden',
  'Neon',
  'Paper',
  'Electric',
  'Hollow',
  'Crimson',
  'Northern',
  'Lonely',
  'Glass',
  'Static',
  'Slow',
  'Bright',
] as const;

const ENG_NOMEN = [
  'Antenna',
  'Harbour',
  'Machine',
  'Orchard',
  'Signal',
  'Parade',
  'Circuit',
  'Lantern',
  'Avenue',
  'Cassette',
  'Mirror',
  'Engine',
  'Motion',
  'Radio',
] as const;

const VORNAMEN = [
  'Lena',
  'Mira',
  'Jonas',
  'Selma',
  'Nino',
  'Elin',
  'Raffael',
  'Tuva',
  'Milo',
  'Anouk',
  'Fabio',
  'Nora',
] as const;

const NACHNAMEN = [
  'Brunner',
  'Steiner',
  'Haldemann',
  'Kessler',
  'Vonlanthen',
  'Amrein',
  'Furrer',
  'Baumann',
  'Gerber',
  'Lüthi',
  'Schaller',
  'Iten',
] as const;

const PRAEPOSITIONEN = ['Zwischen', 'Hinter', 'Über', 'Unter', 'Neben', 'Durch'] as const;

const ADJ_MASKULIN = [
  'Letzter',
  'Später',
  'Stiller',
  'Kalter',
  'Blauer',
  'Halber',
  'Ferner',
  'Leiser',
  'Wilder',
  'Goldener',
] as const;

const NOMEN_MASKULIN = [
  'Zug',
  'Sommer',
  'Morgen',
  'Abend',
  'Regen',
  'Schatten',
  'Winter',
  'Anker',
  'Funke',
  'Hafen',
  'Spiegel',
  'Komet',
] as const;

const ORTE = [
  'Chur',
  'Biel',
  'Genf',
  'Luzern',
  'Bregenz',
  'Lyon',
  'Triest',
  'Hamburg',
  'Bern',
  'Winterthur',
] as const;

/** Titel mit «Nacht», «Love» oder «Liebe» für die LIKE-Aufgaben in Kapitel 4. */
const HAKEN_TITEL = [
  'Nachtfahrt',
  'Love in Slow Motion',
  'Liebe im Nebel',
  'Lange Nacht',
  'Nacht über der Stadt',
  'Love on the Radio',
  'Keine Liebe ohne Regen',
  'Nachtzug nach Chur',
  'Slow Love',
  'Liebe auf Zeit',
] as const;

/** Songtitel, die absichtlich in zwei verschiedenen Alben vorkommen (DISTINCT). */
const DOPPEL_TITEL = ['Nachtfahrt', 'Letzter Zug', 'Love in Slow Motion'] as const;

const HANDLE_WOERTER = [
  'lena',
  'mira',
  'jonas',
  'selma',
  'nino',
  'elin',
  'raffi',
  'tuva',
  'milo',
  'anouk',
  'fabio',
  'nora',
  'beat',
  'sound',
  'vinyl',
  'echo',
  'luna',
  'pixel',
  'tempo',
  'saite',
  'takt',
  'bass',
  'nebel',
  'funke',
] as const;

const HANDLE_ANHANG = [
  'maker',
  'kind',
  'fan',
  'box',
  'welle',
  'stern',
  'hoch',
  'pur',
  'lab',
  'zone',
] as const;

const MAIL_DOMAINS = ['example.ch', 'example.com', 'example.de', 'mail.example.ch'] as const;

/** Abo-Typen mit festem Preis (pro Typ genau ein Preis). */
const ABO_TYPEN: readonly (readonly [string, number, number])[] = [
  // [typ, preis, gewicht]
  ['Basic', 9.9, 35],
  ['Premium', 12.9, 30],
  ['Familie', 19.9, 15],
  ['Student', 5.9, 20],
];

const PLAYLIST_ADJ = [
  'Lange',
  'Kurze',
  'Leise',
  'Schnelle',
  'Ruhige',
  'Wilde',
  'Goldene',
  'Kalte',
  'Warme',
  'Späte',
] as const;

const PLAYLIST_NOMEN = [
  'Nächte',
  'Morgen',
  'Fahrten',
  'Pausen',
  'Abende',
  'Runden',
  'Wege',
  'Stunden',
  'Tage',
  'Sessions',
] as const;

const PLAYLIST_THEMEN = [
  'Zum Lernen',
  'Beim Kochen',
  'Auf dem Velo',
  'Im Zug',
  'Fürs Joggen',
  'Regentage',
  'Sonntagmorgen',
  'Hausaufgaben',
  'Party im Keller',
  'Chillen am See',
] as const;

// ---------------------------------------------------------------------------
// Datentypen
// ---------------------------------------------------------------------------

export interface Kuenstler {
  id: number;
  name: string;
  land: string;
  gruendungsjahr: number | null;
}

export interface Album {
  id: number;
  titel: string;
  erscheinungsjahr: number;
  kuenstlerId: number;
}

export interface Song {
  id: number;
  titel: string;
  dauerSek: number;
  albumId: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface SongGenre {
  songId: number;
  genreId: number;
}

export interface Nutzer {
  id: number;
  benutzername: string;
  email: string;
  land: string;
  registriertAm: string;
}

export interface Abo {
  id: number;
  typ: string;
  preis: number;
  gueltigBis: string;
  nutzerId: number;
}

export interface Playlist {
  id: number;
  name: string;
  erstelltAm: string;
  nutzerId: number;
}

export interface PlaylistSong {
  playlistId: number;
  songId: number;
  position: number;
  hinzugefuegtAm: string;
}

export interface Bewertung {
  nutzerId: number;
  songId: number;
  sterne: number;
  datum: string;
}

export interface Datensatz {
  kuenstler: Kuenstler[];
  album: Album[];
  song: Song[];
  genre: Genre[];
  songGenre: SongGenre[];
  nutzer: Nutzer[];
  abo: Abo[];
  playlist: Playlist[];
  playlistSong: PlaylistSong[];
  bewertung: Bewertung[];
}

// ---------------------------------------------------------------------------
// Namensgeneratoren
// ---------------------------------------------------------------------------

function kuenstlerName(rnd: Zufall): string {
  switch (ganzzahl(rnd, 1, 4)) {
    case 1:
      return `Die ${waehle(rnd, ADJ_PLURAL)}n ${waehle(rnd, NOMEN_PLURAL)}`;
    case 2:
      return `${waehle(rnd, WORT_VORNE)}${waehle(rnd, WORT_HINTEN)}`;
    case 3:
      return `${waehle(rnd, ENG_ADJ)} ${waehle(rnd, ENG_NOMEN)}`;
    default:
      return `${waehle(rnd, VORNAMEN)} ${waehle(rnd, NACHNAMEN)}`;
  }
}

function albumTitel(rnd: Zufall): string {
  switch (ganzzahl(rnd, 1, 4)) {
    case 1:
      return `${waehle(rnd, ADJ_MASKULIN)} ${waehle(rnd, NOMEN_MASKULIN)}`;
    case 2:
      return `${waehle(rnd, WORT_VORNE)}${waehle(rnd, WORT_HINTEN)}`;
    case 3:
      return `${waehle(rnd, PRAEPOSITIONEN)} ${waehle(rnd, NOMEN_PLURAL)}`;
    default:
      return `${waehle(rnd, ENG_ADJ)} ${waehle(rnd, ENG_NOMEN)}`;
  }
}

function songTitel(rnd: Zufall): string {
  switch (ganzzahl(rnd, 1, 6)) {
    case 1:
      return `${waehle(rnd, PRAEPOSITIONEN)} ${waehle(rnd, NOMEN_PLURAL)}`;
    case 2:
      return `${waehle(rnd, ADJ_MASKULIN)} ${waehle(rnd, NOMEN_MASKULIN)}`;
    case 3:
      return `${waehle(rnd, WORT_VORNE)}${waehle(rnd, WORT_HINTEN)}`;
    case 4:
      return `${waehle(rnd, ENG_ADJ)} ${waehle(rnd, ENG_NOMEN)}`;
    case 5:
      return `${waehle(rnd, ADJ_PLURAL)} ${waehle(rnd, NOMEN_PLURAL)}`;
    default:
      return `${waehle(rnd, NOMEN_MASKULIN)} in ${waehle(rnd, ORTE)}`;
  }
}

function playlistName(rnd: Zufall): string {
  if (rnd() < 0.4) return waehle(rnd, PLAYLIST_THEMEN);
  return `${waehle(rnd, PLAYLIST_ADJ)} ${waehle(rnd, PLAYLIST_NOMEN)}`;
}

function benutzername(rnd: Zufall): string {
  switch (ganzzahl(rnd, 1, 4)) {
    case 1:
      return `${waehle(rnd, HANDLE_WOERTER)}_${ganzzahl(rnd, 80, 99)}`;
    case 2:
      return `${waehle(rnd, HANDLE_WOERTER)}${waehle(rnd, HANDLE_ANHANG)}`;
    case 3:
      return `${waehle(rnd, HANDLE_WOERTER)}${ganzzahl(rnd, 2, 99)}`;
    default:
      return `${waehle(rnd, HANDLE_WOERTER)}_${waehle(rnd, HANDLE_ANHANG)}`;
  }
}

/** Ruft `erzeuge` so lange auf, bis ein noch unbenutzter Wert entsteht. */
function eindeutig(erzeuge: () => string, benutzt: Set<string>, notnagel: string): string {
  for (let versuch = 0; versuch < 200; versuch += 1) {
    const wert = erzeuge();
    if (!benutzt.has(wert)) {
      benutzt.add(wert);
      return wert;
    }
  }
  for (let n = 2; ; n += 1) {
    const wert = `${notnagel} ${n}`;
    if (!benutzt.has(wert)) {
      benutzt.add(wert);
      return wert;
    }
  }
}

// ---------------------------------------------------------------------------
// Datengenerierung
// ---------------------------------------------------------------------------

const ANZAHL_KUENSTLER = 18;
const ANZAHL_ALBEN = 36;
const ANZAHL_NUTZER = 25;
const ANZAHL_ABOS = 20;
const ANZAHL_PLAYLISTS = 50;
const ANZAHL_BEWERTUNGEN = 620;

/** Künstler:in ohne Album (für LEFT JOIN im Additum). */
const KUENSTLER_OHNE_ALBUM = ANZAHL_KUENSTLER;

/** Album mit genau 12 Songs (für Aufgaben mit COUNT/HAVING). */
const ALBUM_MIT_12_SONGS = 1;

/** Playlist id 1, Name kommt genau einmal vor (25 Songs). */
const PLAYLIST_LANGE_NAECHTE = 'Lange Nächte';

/** Nutzer:in aus Liechtenstein, einziges Vorkommen (gut für `=`). */
const NUTZER_LIECHTENSTEIN = 7;

/**
 * Sorgt dafür, dass jedes Land aus `LAENDER` mindestens einmal vorkommt, ohne
 * den PRNG zu benutzen (sonst würden sich alle nachfolgenden Daten verschieben).
 * Überschrieben werden nur Einträge, deren Land mehrfach vorkommt; Sonderfälle
 * wie die eine Person aus Liechtenstein bleiben dadurch erhalten.
 */
function ergaenzeLaender(eintraege: { land: string }[]): void {
  const fehlend = LAENDER.map(([land]) => land).filter((land) =>
    eintraege.every((e) => e.land !== land),
  );
  let index = eintraege.length - 1;
  for (const land of fehlend) {
    while (index >= 0 && eintraege.filter((e) => e.land === eintraege[index]!.land).length < 2) {
      index -= 1;
    }
    if (index < 0) return;
    eintraege[index]!.land = land;
    index -= 1;
  }
}

export function generiereDaten(rnd: Zufall = mulberry32(GENERATOR_SEED)): Datensatz {
  // --- genre -------------------------------------------------------------
  const genre: Genre[] = GENRE_NAMEN.map((name, i) => ({ id: i + 1, name }));

  // --- kuenstler ---------------------------------------------------------
  const kuenstler: Kuenstler[] = [];
  const kuenstlerNamen = new Set<string>();
  // Zwei Künstler:innen ohne Gründungsjahr (NULL für IS NULL-Aufgaben).
  const ohneJahr = new Set([4, 11]);
  for (let id = 1; id <= ANZAHL_KUENSTLER; id += 1) {
    kuenstler.push({
      id,
      name: eindeutig(() => kuenstlerName(rnd), kuenstlerNamen, 'Namenlos'),
      land: waehleGewichtet(rnd, LAENDER),
      gruendungsjahr: ohneJahr.has(id) ? null : ganzzahl(rnd, 1965, 2022),
    });
  }
  ergaenzeLaender(kuenstler);

  // --- album -------------------------------------------------------------
  const mitAlbum = kuenstler.filter((k) => k.id !== KUENSTLER_OHNE_ALBUM);
  const zuordnung: number[] = mitAlbum.map((k) => k.id);
  while (zuordnung.length < ANZAHL_ALBEN) {
    zuordnung.push(waehle(rnd, mitAlbum).id);
  }
  const album: Album[] = zuordnung.map((kuenstlerId, i) => {
    const k = kuenstler[kuenstlerId - 1]!;
    const fruehestens = Math.max(k.gruendungsjahr ?? 1968, 1968);
    return {
      id: i + 1,
      titel: albumTitel(rnd),
      erscheinungsjahr: ganzzahl(rnd, fruehestens, 2025),
      kuenstlerId,
    };
  });

  // --- song --------------------------------------------------------------
  const song: Song[] = [];
  for (const a of album) {
    const anzahl = a.id === ALBUM_MIT_12_SONGS ? 12 : ganzzahl(rnd, 6, 11);
    for (let i = 0; i < anzahl; i += 1) {
      song.push({
        id: song.length + 1,
        titel: songTitel(rnd),
        dauerSek: ganzzahl(rnd, 95, 420),
        albumId: a.id,
      });
    }
  }
  setzeTitelHaken(song);

  // --- song_genre --------------------------------------------------------
  const songGenre: SongGenre[] = [];
  for (const s of song) {
    const erstes = ganzzahl(rnd, 1, genre.length);
    songGenre.push({ songId: s.id, genreId: erstes });
    if (rnd() < 0.45) {
      let zweites = ganzzahl(rnd, 1, genre.length);
      if (zweites === erstes) zweites = (erstes % genre.length) + 1;
      songGenre.push({ songId: s.id, genreId: zweites });
    }
  }

  // --- nutzer ------------------------------------------------------------
  const nutzer: Nutzer[] = [];
  const handles = new Set<string>();
  const mails = new Set<string>();
  for (let id = 1; id <= ANZAHL_NUTZER; id += 1) {
    const handle = eindeutig(() => benutzername(rnd), handles, 'nutzer');
    nutzer.push({
      id,
      benutzername: handle,
      email: eindeutig(
        () => `${handle}@${waehle(rnd, MAIL_DOMAINS)}`,
        mails,
        `${handle}@example.ch`,
      ),
      land: id === NUTZER_LIECHTENSTEIN ? 'Liechtenstein' : waehleGewichtet(rnd, LAENDER),
      registriertAm: datumZwischen(rnd, '2019-01-05', '2025-06-30'),
    });
  }
  ergaenzeLaender(nutzer);

  // --- abo (1:1 zu nutzer, einige Nutzer:innen haben keins) ---------------
  const mitAbo = new Set<number>();
  while (mitAbo.size < ANZAHL_ABOS) {
    mitAbo.add(ganzzahl(rnd, 1, ANZAHL_NUTZER));
  }
  const abo: Abo[] = [...mitAbo]
    .sort((a, b) => a - b)
    .map((nutzerId, i) => {
      const [typ, preis] = waehleGewichtet(
        rnd,
        ABO_TYPEN.map((t) => [t, t[2]] as const),
      );
      // Ein paar wenige Abos sind bereits abgelaufen (gut für Datumsvergleiche).
      const abgelaufen = i % 7 === 2;
      const registriert = nutzer[nutzerId - 1]!.registriertAm;
      const gueltigBis = abgelaufen
        ? datumZwischen(rnd, maxDatum(registriert, '2025-07-01'), '2026-08-31')
        : datumZwischen(rnd, maxDatum(registriert, '2026-10-01'), '2027-12-31');
      return { id: i + 1, typ, preis, gueltigBis, nutzerId };
    });

  // --- playlist ----------------------------------------------------------
  const playlist: Playlist[] = [];
  for (let id = 1; id <= ANZAHL_PLAYLISTS; id += 1) {
    const besitzer = waehle(rnd, nutzer);
    // Playlist 1 heisst «Lange Nächte»; der Name muss eindeutig bleiben, weil
    // Aufgaben und Musterlösungen der LPU darauf verweisen.
    let name = PLAYLIST_LANGE_NAECHTE;
    while (id !== 1 && name === PLAYLIST_LANGE_NAECHTE) {
      name = playlistName(rnd);
    }
    playlist.push({
      id,
      name,
      erstelltAm: datumZwischen(rnd, besitzer.registriertAm, HEUTE),
      nutzerId: besitzer.id,
    });
  }

  // --- playlist_song -----------------------------------------------------
  const playlistSong: PlaylistSong[] = [];
  for (const p of playlist) {
    const anzahl = p.id === 1 ? 25 : ganzzahl(rnd, 5, 25);
    const gewaehlt = new Set<number>();
    while (gewaehlt.size < anzahl) {
      gewaehlt.add(ganzzahl(rnd, 1, song.length));
    }
    let position = 1;
    for (const songId of gewaehlt) {
      playlistSong.push({
        playlistId: p.id,
        songId,
        position,
        hinzugefuegtAm: datumZwischen(rnd, p.erstelltAm, HEUTE),
      });
      position += 1;
    }
  }

  // --- bewertung ---------------------------------------------------------
  const bewertung: Bewertung[] = [];
  const paare = new Set<string>();
  let versuche = 0;
  while (bewertung.length < ANZAHL_BEWERTUNGEN && versuche < ANZAHL_BEWERTUNGEN * 50) {
    versuche += 1;
    const n = waehle(rnd, nutzer);
    const songId = ganzzahl(rnd, 1, song.length);
    const schluessel = `${n.id}:${songId}`;
    if (paare.has(schluessel)) continue;
    paare.add(schluessel);
    bewertung.push({
      nutzerId: n.id,
      songId,
      sterne: waehleGewichtet(rnd, [
        [1, 6],
        [2, 10],
        [3, 24],
        [4, 32],
        [5, 28],
      ]),
      datum: datumZwischen(rnd, n.registriertAm, HEUTE),
    });
  }
  bewertung.sort((a, b) => a.nutzerId - b.nutzerId || a.songId - b.songId);

  const daten: Datensatz = {
    kuenstler,
    album,
    song,
    genre,
    songGenre,
    nutzer,
    abo,
    playlist,
    playlistSong,
    bewertung,
  };
  pruefeDaten(daten);
  return daten;
}

/**
 * Setzt die «Haken» für die Übungen: Titel mit Nacht/Love/Liebe (LIKE) und
 * einige doppelte Songtitel über Albumgrenzen hinweg (DISTINCT).
 */
function setzeTitelHaken(song: Song[]): void {
  const n = song.length;
  HAKEN_TITEL.forEach((titel, i) => {
    const index = Math.floor(((i + 0.5) * n) / HAKEN_TITEL.length);
    song[index]!.titel = titel;
  });
  DOPPEL_TITEL.forEach((titel, i) => {
    const start = Math.floor(((i + 0.25) * n) / DOPPEL_TITEL.length);
    const original = song[start]!;
    let ziel = (start + 37) % n;
    while (song[ziel]!.albumId === original.albumId) {
      ziel = (ziel + 1) % n;
    }
    original.titel = titel;
    song[ziel]!.titel = titel;
  });
}

function istIsoDatum(wert: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(wert);
}

/** Wirft, sobald eine Zusicherung verletzt ist, die der Seed-Test prüft. */
function pruefeDaten(d: Datensatz): void {
  const fehler: string[] = [];
  const pruefe = (bedingung: boolean, text: string) => {
    if (!bedingung) fehler.push(text);
  };

  const zusammenhaengend = (ids: number[], name: string) => {
    ids.forEach((id, i) => pruefe(id === i + 1, `${name}: id ${id} an Position ${i + 1}`));
  };
  zusammenhaengend(
    d.kuenstler.map((x) => x.id),
    'kuenstler',
  );
  zusammenhaengend(
    d.album.map((x) => x.id),
    'album',
  );
  zusammenhaengend(
    d.song.map((x) => x.id),
    'song',
  );
  zusammenhaengend(
    d.genre.map((x) => x.id),
    'genre',
  );
  zusammenhaengend(
    d.nutzer.map((x) => x.id),
    'nutzer',
  );
  zusammenhaengend(
    d.playlist.map((x) => x.id),
    'playlist',
  );
  zusammenhaengend(
    d.abo.map((x) => x.id),
    'abo',
  );

  // Referenzen
  const nutzerNachId = new Map(d.nutzer.map((n) => [n.id, n]));
  const albumIds = new Set(d.album.map((a) => a.id));
  const songIds = new Set(d.song.map((s) => s.id));
  const genreIds = new Set(d.genre.map((g) => g.id));
  const nutzerIds = new Set(d.nutzer.map((n) => n.id));
  const playlistIds = new Set(d.playlist.map((p) => p.id));
  const kuenstlerIds = new Set(d.kuenstler.map((k) => k.id));
  pruefe(
    d.album.every((a) => kuenstlerIds.has(a.kuenstlerId)),
    'album.kuenstler_id ungültig',
  );
  pruefe(
    d.song.every((s) => albumIds.has(s.albumId)),
    'song.album_id ungültig',
  );
  pruefe(
    d.songGenre.every((sg) => songIds.has(sg.songId) && genreIds.has(sg.genreId)),
    'song_genre ungültig',
  );
  pruefe(
    d.playlist.every((p) => nutzerIds.has(p.nutzerId)),
    'playlist.nutzer_id ungültig',
  );
  pruefe(
    d.playlistSong.every((ps) => playlistIds.has(ps.playlistId) && songIds.has(ps.songId)),
    'playlist_song ungültig',
  );
  pruefe(
    d.bewertung.every((b) => nutzerIds.has(b.nutzerId) && songIds.has(b.songId)),
    'bewertung ungültig',
  );
  pruefe(
    d.abo.every((a) => nutzerIds.has(a.nutzerId)),
    'abo.nutzer_id ungültig',
  );
  pruefe(
    new Set(d.abo.map((a) => a.nutzerId)).size === d.abo.length,
    'abo.nutzer_id nicht eindeutig (1:1 verletzt)',
  );
  pruefe(d.nutzer.length - d.abo.length >= 3, 'weniger als 3 nutzer ohne abo');
  pruefe(
    d.abo.every((a) => a.preis > 0),
    'abo.preis nicht positiv',
  );
  pruefe(
    d.abo.every((a) => ABO_TYPEN.some(([typ, preis]) => typ === a.typ && preis === a.preis)),
    'abo.preis passt nicht zum typ',
  );
  pruefe(
    d.abo.every((a) => istIsoDatum(a.gueltigBis)),
    'abo.gueltig_bis nicht ISO',
  );
  pruefe(
    d.abo.some((a) => a.gueltigBis < '2026-09-01'),
    'kein abgelaufenes abo',
  );
  pruefe(
    d.abo.some((a) => a.gueltigBis >= '2026-10-01'),
    'kein laufendes abo',
  );
  pruefe(
    d.abo.every((a) => a.gueltigBis >= nutzerNachId.get(a.nutzerId)!.registriertAm),
    'gueltig_bis vor registriert_am',
  );
  pruefe(
    new Set(d.nutzer.map((n) => n.benutzername)).size === d.nutzer.length,
    'benutzername nicht eindeutig',
  );
  pruefe(new Set(d.nutzer.map((n) => n.email)).size === d.nutzer.length, 'email nicht eindeutig');

  // Mengen
  pruefe(d.kuenstler.length >= 15 && d.kuenstler.length <= 20, 'kuenstler ausserhalb 15..20');
  pruefe(d.album.length >= 30 && d.album.length <= 40, 'album ausserhalb 30..40');
  pruefe(d.song.length >= 200 && d.song.length <= 400, 'song ausserhalb 200..400');
  pruefe(d.genre.length >= 8 && d.genre.length <= 10, 'genre ausserhalb 8..10');
  pruefe(d.nutzer.length >= 20 && d.nutzer.length <= 30, 'nutzer ausserhalb 20..30');
  pruefe(d.playlist.length >= 40 && d.playlist.length <= 60, 'playlist ausserhalb 40..60');
  pruefe(d.bewertung.length >= 400, 'zu wenige bewertung');

  // Haken für die Aufgaben
  const mitAlbum = new Set(d.album.map((a) => a.kuenstlerId));
  pruefe(d.kuenstler.filter((k) => !mitAlbum.has(k.id)).length === 1, 'nicht genau 1 ohne Album');
  pruefe(
    d.kuenstler.filter((k) => k.gruendungsjahr === null).length >= 2,
    'weniger als 2 ohne Gründungsjahr',
  );
  pruefe(
    d.nutzer.filter((n) => n.land === 'Liechtenstein').length === 1,
    'nicht genau 1 aus Liechtenstein',
  );
  for (const [land] of LAENDER) {
    pruefe(
      d.kuenstler.some((k) => k.land === land),
      `kein kuenstler aus ${land}`,
    );
    pruefe(
      d.nutzer.some((n) => n.land === land),
      `kein nutzer aus ${land}`,
    );
  }
  pruefe(
    d.playlist.filter((p) => p.name === PLAYLIST_LANGE_NAECHTE).length === 1,
    'Playlist «Lange Nächte» fehlt',
  );
  pruefe(
    d.playlistSong.filter((ps) => ps.playlistId === 1).length === 25,
    'Playlist 1 hat nicht 25 Songs',
  );
  pruefe(
    d.song.filter((s) => s.albumId === ALBUM_MIT_12_SONGS).length === 12,
    'Album 1 hat nicht 12 Songs',
  );
  const suchTitel = d.song.filter((s) => /nacht|love|liebe/i.test(s.titel));
  pruefe(suchTitel.length >= 3, 'zu wenige Titel mit Nacht/Love/Liebe');
  const proTitel = new Map<string, Set<number>>();
  for (const s of d.song) {
    const alben = proTitel.get(s.titel) ?? new Set<number>();
    alben.add(s.albumId);
    proTitel.set(s.titel, alben);
  }
  pruefe(
    [...proTitel.values()].some((alben) => alben.size >= 2),
    'kein doppelter Songtitel über Alben hinweg',
  );

  // Genre, Positionen, Daten
  const genresProSong = new Set(d.songGenre.map((sg) => sg.songId));
  pruefe(genresProSong.size === d.song.length, 'Song ohne Genre');
  const positionen = new Map<number, number[]>();
  for (const ps of d.playlistSong) {
    const liste = positionen.get(ps.playlistId) ?? [];
    liste.push(ps.position);
    positionen.set(ps.playlistId, liste);
  }
  for (const [id, liste] of positionen) {
    const sortiert = [...liste].sort((a, b) => a - b);
    pruefe(
      sortiert.every((p, i) => p === i + 1),
      `Playlist ${id}: Positionen nicht lückenlos`,
    );
  }
  pruefe(
    d.nutzer.every((n) => istIsoDatum(n.registriertAm)),
    'registriert_am nicht ISO',
  );
  pruefe(
    d.playlist.every((p) => istIsoDatum(p.erstelltAm)),
    'erstellt_am nicht ISO',
  );
  pruefe(
    d.playlistSong.every((ps) => istIsoDatum(ps.hinzugefuegtAm)),
    'hinzugefuegt_am nicht ISO',
  );
  pruefe(
    d.bewertung.every((b) => istIsoDatum(b.datum)),
    'datum nicht ISO',
  );
  const playlistNachId = new Map(d.playlist.map((p) => [p.id, p]));
  pruefe(
    d.playlist.every((p) => p.erstelltAm >= nutzerNachId.get(p.nutzerId)!.registriertAm),
    'erstellt_am vor registriert_am',
  );
  pruefe(
    d.playlistSong.every(
      (ps) => ps.hinzugefuegtAm >= playlistNachId.get(ps.playlistId)!.erstelltAm,
    ),
    'hinzugefuegt_am vor erstellt_am',
  );
  pruefe(
    d.bewertung.every((b) => b.datum >= nutzerNachId.get(b.nutzerId)!.registriertAm),
    'bewertung.datum vor registriert_am',
  );
  pruefe(
    d.bewertung.every((b) => b.sterne >= 1 && b.sterne <= 5),
    'sterne ausserhalb 1..5',
  );
  pruefe(
    d.song.every((s) => s.dauerSek >= 95 && s.dauerSek <= 420),
    'dauer_sek ausserhalb 95..420',
  );
  const kuenstlerNachId = new Map(d.kuenstler.map((k) => [k.id, k]));
  pruefe(
    d.album.every((a) => {
      const g = kuenstlerNachId.get(a.kuenstlerId)!.gruendungsjahr;
      return a.erscheinungsjahr <= 2025 && (g === null || a.erscheinungsjahr >= g);
    }),
    'erscheinungsjahr unplausibel',
  );

  if (fehler.length > 0) {
    throw new Error(`Generierte Daten verletzen Zusicherungen:\n- ${fehler.join('\n- ')}`);
  }
}

// ---------------------------------------------------------------------------
// SQL-Ausgabe
// ---------------------------------------------------------------------------

type SqlWert = string | number | null | { readonly roh: string };

/** Unverändert ausgegebenes SQL-Literal, z. B. `9.90` statt `9.9`. */
function roh(literal: string): SqlWert {
  return { roh: literal };
}

function sqlWert(wert: SqlWert): string {
  if (wert === null) return 'NULL';
  if (typeof wert === 'number') return String(wert);
  if (typeof wert === 'object') return wert.roh;
  return `'${wert.replace(/'/g, "''")}'`;
}

function insertBloecke(
  tabelle: string,
  spalten: readonly string[],
  zeilen: readonly (readonly SqlWert[])[],
): string {
  const bloecke: string[] = [];
  for (let i = 0; i < zeilen.length; i += CHUNK) {
    const teil = zeilen.slice(i, i + CHUNK);
    const werte = teil.map((z) => `  (${z.map(sqlWert).join(', ')})`).join(',\n');
    bloecke.push(`INSERT INTO ${tabelle} (${spalten.join(', ')}) VALUES\n${werte};`);
  }
  return bloecke.join('\n\n');
}

/** Das DDL wird im Tabellen-Tab «DDL» wörtlich angezeigt, darum lesbar formatiert. */
export function buildDdl(): string {
  return `CREATE TABLE kuenstler (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  land           TEXT NOT NULL,
  gruendungsjahr INTEGER
);

CREATE TABLE album (
  id               INTEGER PRIMARY KEY,
  titel            TEXT NOT NULL,
  erscheinungsjahr INTEGER NOT NULL,
  kuenstler_id     INTEGER NOT NULL,
  FOREIGN KEY (kuenstler_id) REFERENCES kuenstler (id)
);

CREATE TABLE song (
  id        INTEGER PRIMARY KEY,
  titel     TEXT NOT NULL,
  dauer_sek INTEGER NOT NULL,
  album_id  INTEGER NOT NULL,
  FOREIGN KEY (album_id) REFERENCES album (id)
);

CREATE TABLE genre (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE song_genre (
  song_id  INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (song_id, genre_id),
  FOREIGN KEY (song_id) REFERENCES song (id),
  FOREIGN KEY (genre_id) REFERENCES genre (id)
);

CREATE TABLE nutzer (
  id             INTEGER PRIMARY KEY,
  benutzername   TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL UNIQUE,
  land           TEXT NOT NULL,
  registriert_am TEXT NOT NULL -- ISO-Datum, z. B. '2023-04-17'
);

CREATE TABLE abo (
  id          INTEGER PRIMARY KEY,
  typ         TEXT NOT NULL,
  preis       REAL NOT NULL,
  gueltig_bis TEXT, -- ISO-Datum, z. B. '2023-04-17'
  nutzer_id   INTEGER NOT NULL UNIQUE, -- 1:1, jede Person hat höchstens ein Abo
  FOREIGN KEY (nutzer_id) REFERENCES nutzer (id)
);

CREATE TABLE playlist (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  erstellt_am TEXT NOT NULL, -- ISO-Datum, z. B. '2023-04-17'
  nutzer_id   INTEGER NOT NULL,
  FOREIGN KEY (nutzer_id) REFERENCES nutzer (id)
);

CREATE TABLE playlist_song (
  playlist_id     INTEGER NOT NULL,
  song_id         INTEGER NOT NULL,
  position        INTEGER NOT NULL,
  hinzugefuegt_am TEXT NOT NULL, -- ISO-Datum, z. B. '2023-04-17'
  PRIMARY KEY (playlist_id, song_id),
  FOREIGN KEY (playlist_id) REFERENCES playlist (id),
  FOREIGN KEY (song_id) REFERENCES song (id)
);

CREATE TABLE bewertung (
  nutzer_id INTEGER NOT NULL,
  song_id   INTEGER NOT NULL,
  sterne    INTEGER NOT NULL CHECK (sterne BETWEEN 1 AND 5),
  datum     TEXT NOT NULL, -- ISO-Datum, z. B. '2023-04-17'
  PRIMARY KEY (nutzer_id, song_id),
  FOREIGN KEY (nutzer_id) REFERENCES nutzer (id),
  FOREIGN KEY (song_id) REFERENCES song (id)
);`;
}

/** Alle INSERTs in FK-sicherer Reihenfolge. */
export function buildInserts(d: Datensatz): string {
  const abschnitte = [
    insertBloecke(
      'kuenstler',
      ['id', 'name', 'land', 'gruendungsjahr'],
      d.kuenstler.map((k) => [k.id, k.name, k.land, k.gruendungsjahr]),
    ),
    insertBloecke(
      'album',
      ['id', 'titel', 'erscheinungsjahr', 'kuenstler_id'],
      d.album.map((a) => [a.id, a.titel, a.erscheinungsjahr, a.kuenstlerId]),
    ),
    insertBloecke(
      'song',
      ['id', 'titel', 'dauer_sek', 'album_id'],
      d.song.map((s) => [s.id, s.titel, s.dauerSek, s.albumId]),
    ),
    insertBloecke(
      'genre',
      ['id', 'name'],
      d.genre.map((g) => [g.id, g.name]),
    ),
    insertBloecke(
      'song_genre',
      ['song_id', 'genre_id'],
      d.songGenre.map((sg) => [sg.songId, sg.genreId]),
    ),
    insertBloecke(
      'nutzer',
      ['id', 'benutzername', 'email', 'land', 'registriert_am'],
      d.nutzer.map((n) => [n.id, n.benutzername, n.email, n.land, n.registriertAm]),
    ),
    insertBloecke(
      'abo',
      ['id', 'typ', 'preis', 'gueltig_bis', 'nutzer_id'],
      d.abo.map((a) => [a.id, a.typ, roh(a.preis.toFixed(2)), a.gueltigBis, a.nutzerId]),
    ),
    insertBloecke(
      'playlist',
      ['id', 'name', 'erstellt_am', 'nutzer_id'],
      d.playlist.map((p) => [p.id, p.name, p.erstelltAm, p.nutzerId]),
    ),
    insertBloecke(
      'playlist_song',
      ['playlist_id', 'song_id', 'position', 'hinzugefuegt_am'],
      d.playlistSong.map((ps) => [ps.playlistId, ps.songId, ps.position, ps.hinzugefuegtAm]),
    ),
    insertBloecke(
      'bewertung',
      ['nutzer_id', 'song_id', 'sterne', 'datum'],
      d.bewertung.map((b) => [b.nutzerId, b.songId, b.sterne, b.datum]),
    ),
  ];
  const namen = [
    'kuenstler',
    'album',
    'song',
    'genre',
    'song_genre',
    'nutzer',
    'abo',
    'playlist',
    'playlist_song',
    'bewertung',
  ];
  return abschnitte.map((block, i) => `-- ${namen[i]}\n${block}`).join('\n\n');
}

/** Vollständiges Seed-Script. Rein, schreibt keine Dateien. */
export function buildSeedSql(): string {
  const daten = generiereDaten(mulberry32(GENERATOR_SEED));
  const kopf = [
    '-- Musik-Streaming, Beispieldatenbank der LPU «Datenmodellierung und Datenbanken»',
    `-- Generiert von scripts/generate-seed.ts (Seed ${GENERATOR_SEED}, Version ${SEED_VERSION}). Nicht von Hand editieren.`,
    '-- Streaming-Dienst «kanti♪tunes». Alle Künstler:innen, Titel und Personen sind frei erfunden.',
  ].join('\n');
  return `${kopf}\n\n${buildDdl()}\n\nBEGIN;\n\n${buildInserts(daten)}\n\nCOMMIT;\n`;
}

// ---------------------------------------------------------------------------
// Einstiegspunkt (nur beim direkten Aufruf, nicht beim Import)
// ---------------------------------------------------------------------------

export const ZIEL_DATEI = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'seeds',
  'musik_streaming.sql',
);

function main(): void {
  const sql = buildSeedSql();
  writeFileSync(ZIEL_DATEI, sql, 'utf8');
  process.stdout.write(`${ZIEL_DATEI} geschrieben (${sql.length} Zeichen)\n`);
}

if ((process.argv[1] ?? '').endsWith('generate-seed.ts')) {
  main();
}
