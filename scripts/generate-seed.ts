/**
 * Generator für die Beispieldatenbank «Musik-Streaming» der LPU
 * «Datenmodellierung und Datenbanken».
 *
 * Künstler:innen, Alben und Songs sind echt (siehe `KATALOG`), Nutzer:innen,
 * Abos, Playlists und Bewertungen werden erfunden.
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
export const SEED_VERSION = 6;

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
// Katalog: echte Künstler:innen, Alben und Songs
// ---------------------------------------------------------------------------

/*
 * Titel, Erscheinungsjahre und Dauern stammen aus den Tracklisten der
 * Standardausgaben auf Wikipedia (en, für «Creuza de mä» it), für die
 * Schweizer Alben, Mahmood und «13» aus MusicBrainz. Schreibweisen folgen
 * diesen Quellen. Pro Album steht nur eine Auswahl der Songs im Katalog,
 * ausser bei «I Put a Spell on You» (alle 12 Songs, für COUNT/HAVING).
 *
 * gruendungsjahr: Bands mit Gründungsjahr, Solo-Artists NULL. Ebenfalls NULL
 * ist das Duo Lo & Leduc (kein festes Gründungsjahr belegt).
 *
 * Bewusste Konstellationen für die Aufgaben:
 * - Nemo hat kein Album (LEFT JOIN).
 * - «Bohemian Rhapsody» und «We Will Rock You» stehen auf einem Studioalbum und
 *   auf «Greatest Hits», «Somebody to Love» bei Queen und Conchita Wurst
 *   (gleicher Titel in mehreren Alben, DISTINCT).
 * - Titel mit «Nacht», «Love» oder «Liebe» (LIKE); «In diesen Nächten» findet
 *   LIKE '%nacht%' nicht.
 * - Album «Beyoncé» heisst wie die Künstlerin, «Vögu zum Geburtstag» und
 *   «Bittersüessi Pille» wie je ein Song darauf.
 */

const GENRE_NAMEN = [
  'Pop',
  'Rock',
  'Hip-Hop',
  'Elektro',
  'Jazz',
  'Soul',
  'Folk',
  'Punk',
  'Schlager',
  'Mundart',
] as const;

type GenreName = (typeof GENRE_NAMEN)[number];

/** [titel, dauer als 'm:ss', Genres falls abweichend vom Album]. */
type KatalogSong = readonly [string, string, (readonly GenreName[])?];

interface KatalogAlbum {
  titel: string;
  jahr: number;
  genres: readonly GenreName[];
  songs: readonly KatalogSong[];
}

interface KatalogKuenstler {
  name: string;
  land: string;
  gruendungsjahr: number | null;
  alben: readonly KatalogAlbum[];
}

const KATALOG: readonly KatalogKuenstler[] = [
  {
    name: 'Taylor Swift',
    land: 'USA',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Fearless',
        jahr: 2008,
        genres: ['Pop'],
        songs: [
          ['Fearless', '4:01'],
          ['Fifteen', '4:54'],
          ['Love Story', '3:55'],
          ['White Horse', '3:54', ['Pop', 'Folk']],
          ['You Belong with Me', '3:51'],
          ['Breathe', '4:23'],
          ["You're Not Sorry", '4:21'],
          ['Forever & Always', '3:45'],
          ['Change', '4:40'],
        ],
      },
      {
        titel: '1989',
        jahr: 2014,
        genres: ['Pop'],
        songs: [
          ['Welcome to New York', '3:32'],
          ['Blank Space', '3:51'],
          ['Style', '3:51', ['Pop', 'Elektro']],
          ['Out of the Woods', '3:55'],
          ['Shake It Off', '3:39'],
          ['Bad Blood', '3:31', ['Pop', 'Hip-Hop']],
          ['Wildest Dreams', '3:40'],
          ['This Love', '4:10'],
          ['Clean', '4:30'],
        ],
      },
    ],
  },
  {
    name: 'Adele',
    land: 'UK',
    gruendungsjahr: null,
    alben: [
      {
        titel: '21',
        jahr: 2011,
        genres: ['Pop', 'Soul'],
        songs: [
          ['Rolling in the Deep', '3:49'],
          ['Rumour Has It', '3:43'],
          ['Turning Tables', '4:10'],
          ['Set Fire to the Rain', '4:01'],
          ["He Won't Go", '4:37'],
          ['One and Only', '5:48'],
          ['Lovesong', '5:16'],
          ['Someone like You', '4:47'],
        ],
      },
      {
        titel: '25',
        jahr: 2015,
        genres: ['Pop', 'Soul'],
        songs: [
          ['Hello', '4:55'],
          ['Send My Love (To Your New Lover)', '3:43'],
          ['When We Were Young', '4:51'],
          ['Remedy', '4:05'],
          ['Water Under the Bridge', '4:00'],
          ['Love in the Dark', '4:46'],
          ['All I Ask', '4:32'],
        ],
      },
    ],
  },
  {
    name: 'Queen',
    land: 'UK',
    gruendungsjahr: 1970,
    alben: [
      {
        titel: 'A Night at the Opera',
        jahr: 1975,
        genres: ['Rock'],
        songs: [
          ['Death on Two Legs', '3:43'],
          ["I'm in Love with My Car", '3:05'],
          ["You're My Best Friend", '2:50', ['Rock', 'Pop']],
          ["'39", '3:30'],
          ['Seaside Rendezvous', '2:13'],
          ['Love of My Life', '3:38'],
          ['Good Company', '3:26'],
          ['Bohemian Rhapsody', '5:55'],
        ],
      },
      {
        titel: 'News of the World',
        jahr: 1977,
        genres: ['Rock'],
        songs: [
          ['We Will Rock You', '2:01'],
          ['We Are the Champions', '2:59'],
          ['Sheer Heart Attack', '3:26', ['Rock', 'Punk']],
          ['Spread Your Wings', '4:34'],
          ['Get Down, Make Love', '3:51'],
          ["It's Late", '6:26'],
          ['My Melancholy Blues', '3:29', ['Rock', 'Jazz']],
        ],
      },
      {
        titel: 'Greatest Hits',
        jahr: 1981,
        genres: ['Rock'],
        songs: [
          ['Bohemian Rhapsody', '5:57'],
          ['Another One Bites the Dust', '3:36', ['Rock', 'Pop']],
          ['Killer Queen', '2:57'],
          ['Bicycle Race', '3:01'],
          ["Don't Stop Me Now", '3:29', ['Rock', 'Pop']],
          ['Crazy Little Thing Called Love', '2:42'],
          ['Somebody to Love', '4:56'],
          ['We Will Rock You', '2:01'],
          ['We Are the Champions', '3:00'],
        ],
      },
    ],
  },
  {
    name: 'The Beatles',
    land: 'UK',
    gruendungsjahr: 1960,
    alben: [
      {
        titel: "A Hard Day's Night",
        jahr: 1964,
        genres: ['Rock', 'Pop'],
        songs: [
          ["A Hard Day's Night", '2:34'],
          ['I Should Have Known Better', '2:43'],
          ['If I Fell', '2:19'],
          ['And I Love Her', '2:30'],
          ["Can't Buy Me Love", '2:12'],
          ['Things We Said Today', '2:35'],
          ["I'll Be Back", '2:24'],
        ],
      },
      {
        titel: 'Help!',
        jahr: 1965,
        genres: ['Rock', 'Pop'],
        songs: [
          ['Help!', '2:18'],
          ['The Night Before', '2:34'],
          ["You've Got to Hide Your Love Away", '2:09', ['Pop', 'Folk']],
          ['Ticket to Ride', '3:09'],
          ['Act Naturally', '2:30'],
          ["I've Just Seen a Face", '2:05'],
          ['Yesterday', '2:05', ['Pop']],
        ],
      },
      {
        titel: 'Abbey Road',
        jahr: 1969,
        genres: ['Rock'],
        songs: [
          ['Come Together', '4:19'],
          ['Something', '3:02', ['Rock', 'Pop']],
          ["Maxwell's Silver Hammer", '3:27'],
          ['Oh! Darling', '3:27'],
          ["Octopus's Garden", '2:51', ['Rock', 'Pop']],
          ['Here Comes the Sun', '3:05', ['Rock', 'Pop']],
          ['Because', '2:45'],
          ['You Never Give Me Your Money', '4:03'],
          ['The End', '2:05'],
        ],
      },
    ],
  },
  {
    name: 'Bob Dylan',
    land: 'USA',
    gruendungsjahr: null,
    alben: [
      {
        titel: "The Freewheelin' Bob Dylan",
        jahr: 1963,
        genres: ['Folk'],
        songs: [
          ["Blowin' in the Wind", '2:48'],
          ['Girl from the North Country', '3:22'],
          ['Masters of War', '4:34'],
          ["Bob Dylan's Blues", '2:23'],
          ["A Hard Rain's a-Gonna Fall", '6:55'],
          ["Don't Think Twice, It's All Right", '3:40'],
          ['Oxford Town', '1:50'],
          ['Corrina, Corrina', '2:44'],
        ],
      },
      {
        titel: 'Highway 61 Revisited',
        jahr: 1965,
        genres: ['Rock', 'Folk'],
        songs: [
          ['Like a Rolling Stone', '6:13'],
          ['Tombstone Blues', '5:56'],
          ['It Takes a Lot to Laugh, It Takes a Train to Cry', '4:09'],
          ['From a Buick 6', '3:19', ['Rock']],
          ['Ballad of a Thin Man', '5:58'],
          ['Highway 61 Revisited', '3:30', ['Rock']],
        ],
      },
    ],
  },
  {
    // Album mit genau 12 Songs (vollständig), für COUNT/HAVING.
    name: 'Nina Simone',
    land: 'USA',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'I Put a Spell on You',
        jahr: 1965,
        genres: ['Jazz'],
        songs: [
          ['I Put a Spell on You', '2:34', ['Jazz', 'Soul']],
          ['Tomorrow Is My Turn', '2:48'],
          ['Ne me quitte pas', '3:34'],
          ['Marriage Is for Old Folks', '3:29'],
          ['July Tree', '2:41', ['Jazz', 'Folk']],
          ['Gimme Some', '2:57', ['Jazz', 'Soul']],
          ['Feeling Good', '2:53', ['Jazz', 'Soul']],
          ['One September Day', '2:48'],
          ['Blues on Purpose', '3:16'],
          ['Beautiful Land', '1:54'],
          ["You've Got to Learn", '2:41'],
          ['Take Care of Business', '2:03', ['Jazz', 'Soul']],
        ],
      },
    ],
  },
  {
    name: 'Kendrick Lamar',
    land: 'USA',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'To Pimp a Butterfly',
        jahr: 2015,
        genres: ['Hip-Hop'],
        songs: [
          ["Wesley's Theory", '4:47'],
          ['King Kunta', '3:54'],
          ['Institutionalized', '4:31'],
          ['These Walls', '5:00', ['Hip-Hop', 'Soul']],
          ['Alright', '3:39', ['Hip-Hop', 'Jazz']],
          ['Momma', '4:43'],
          ['Hood Politics', '4:52'],
          ['The Blacker the Berry', '5:28'],
          ['I', '5:36'],
        ],
      },
      {
        titel: 'Damn',
        jahr: 2017,
        genres: ['Hip-Hop'],
        songs: [
          ['DNA', '3:05'],
          ['Yah', '2:40'],
          ['Element', '3:28'],
          ['Loyalty', '3:47'],
          ['Pride', '4:35'],
          ['Humble', '2:57'],
          ['Love', '3:33', ['Hip-Hop', 'Pop']],
          ['XXX', '4:14'],
          ['Duckworth', '4:08'],
        ],
      },
    ],
  },
  {
    name: 'Billie Eilish',
    land: 'USA',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'When We All Fall Asleep, Where Do We Go?',
        jahr: 2019,
        genres: ['Pop'],
        songs: [
          ['Bad Guy', '3:14', ['Pop', 'Elektro']],
          ['Xanny', '4:04'],
          ['You Should See Me in a Crown', '3:01', ['Pop', 'Elektro']],
          ['All the Good Girls Go to Hell', '2:49'],
          ["When the Party's Over", '3:16'],
          ['Bury a Friend', '3:13', ['Pop', 'Elektro']],
          ['Ilomilo', '2:36'],
          ['I Love You', '4:52'],
          ['Listen Before I Go', '4:03'],
          ['Goodbye', '1:59'],
        ],
      },
      {
        titel: 'Happier Than Ever',
        jahr: 2021,
        genres: ['Pop'],
        songs: [
          ['Getting Older', '4:04'],
          ['My Future', '3:30', ['Pop', 'Jazz']],
          ['Oxytocin', '3:30', ['Pop', 'Elektro']],
          ['Lost Cause', '3:32'],
          ['Your Power', '4:05', ['Pop', 'Folk']],
          ['NDA', '3:15'],
          ['Therefore I Am', '2:53'],
          ['Happier Than Ever', '4:58', ['Pop', 'Rock']],
        ],
      },
      {
        titel: 'Hit Me Hard and Soft',
        jahr: 2024,
        genres: ['Pop'],
        songs: [
          ['Skinny', '3:39'],
          ['Lunch', '3:00'],
          ['Chihiro', '5:03', ['Pop', 'Elektro']],
          ['Birds of a Feather', '3:30'],
          ['Wildflower', '4:21'],
          ['The Greatest', '4:53'],
          ["L'Amour de Ma Vie", '5:33'],
          ['Blue', '5:43'],
        ],
      },
    ],
  },
  {
    name: 'Daft Punk',
    land: 'Frankreich',
    gruendungsjahr: 1993,
    alben: [
      {
        titel: 'Discovery',
        jahr: 2001,
        genres: ['Elektro'],
        songs: [
          ['One More Time', '5:20', ['Elektro', 'Pop']],
          ['Aerodynamic', '3:27'],
          ['Digital Love', '4:58', ['Elektro', 'Pop']],
          ['Harder, Better, Faster, Stronger', '3:45'],
          ['Crescendolls', '3:31'],
          ['Superheroes', '3:57'],
          ['High Life', '3:22'],
          ['Something About Us', '3:51'],
          ['Voyager', '3:47'],
          ['Veridis Quo', '5:44'],
          ['Face to Face', '3:58'],
        ],
      },
      {
        titel: 'Random Access Memories',
        jahr: 2013,
        genres: ['Elektro'],
        songs: [
          ['Give Life Back to Music', '4:34'],
          ['The Game of Love', '5:22'],
          ['Within', '3:48'],
          ['Instant Crush', '5:37', ['Elektro', 'Pop']],
          ['Lose Yourself to Dance', '5:53', ['Elektro', 'Soul']],
          ['Get Lucky', '6:09', ['Elektro', 'Pop']],
          ['Fragments of Time', '4:39'],
          ["Doin' It Right", '4:11'],
        ],
      },
    ],
  },
  {
    name: 'Steff la Cheffe',
    land: 'Schweiz',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Bittersüessi Pille',
        jahr: 2010,
        genres: ['Mundart', 'Hip-Hop'],
        songs: [
          ['Annabelle', '3:36'],
          ['Hr. Doktor', '2:14'],
          ['Bittersüessi Pille', '4:44'],
          ['Im Momänt', '3:51'],
          ['Schaffe das', '3:51'],
          ['Briche Brot', '4:16'],
          ['Wo bisch?', '3:57', ['Mundart', 'Pop']],
          ['Schön', '4:25', ['Mundart', 'Pop']],
        ],
      },
      {
        titel: 'Vögu zum Geburtstag',
        jahr: 2013,
        genres: ['Mundart', 'Hip-Hop'],
        songs: [
          ['Maschine louft', '4:15'],
          ['Meitschi vom Breitsch', '5:24'],
          ['Ha ke Ahnig', '3:22', ['Mundart', 'Pop']],
          ['Schäri, Schtei, Papier', '4:23'],
          ['Tiefer gah', '3:53'],
          ['Chrieg i dim Chopf', '5:03'],
          ['Grächtigkeitsgass', '4:01'],
          ['Vögu zum Geburtstag', '4:04'],
        ],
      },
    ],
  },
  {
    name: 'Patent Ochsner',
    land: 'Schweiz',
    gruendungsjahr: 1990,
    alben: [
      {
        titel: 'Stella Nera',
        jahr: 1997,
        genres: ['Mundart', 'Rock'],
        songs: [
          ['Sunnechünig', '5:07'],
          ['W. Nuss vo Bümpliz', '5:31'],
          ['Bonjour Hellville', '2:48'],
          ['Seemann’s Wärmuet', '3:51'],
          ['Los', '4:14'],
          ['La Madonnina', '2:29', ['Rock']],
          ['Freivogel', '4:25'],
          ['Brügg', '4:32'],
          ['Schruubstock', '6:32'],
        ],
      },
      {
        titel: 'Tag & Nacht',
        jahr: 2025,
        genres: ['Mundart', 'Rock'],
        songs: [
          ['Lümu', '3:03'],
          ['Hannah Luna', '3:52'],
          ['Brienz', '2:07'],
          ['Mama Be', '4:06'],
          ['Chopf oder Zahl', '3:53'],
          ['Stäffisburg', '4:14'],
          ['Dämone', '4:32'],
          ['Flieder', '3:01'],
          ['Moosrose', '4:52'],
        ],
      },
    ],
  },
  {
    name: 'Sophie Hunger',
    land: 'Schweiz',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Monday’s Ghost',
        jahr: 2008,
        genres: ['Folk', 'Jazz'],
        songs: [
          ['Shape', '3:32', ['Folk', 'Rock']],
          ['The Boat Is Full', '3:02', ['Folk']],
          ['A Protest Song', '3:24', ['Folk']],
          ['Walzer für Niemand', '2:25'],
          ['Sophie Hunger Blues', '5:14'],
          ['Round and Round', '3:28', ['Folk']],
          ['Rise and Fall', '5:31', ['Folk', 'Rock']],
          ['Monday’s Ghost', '4:50'],
          ['Spiegelbild', '3:50', ['Folk', 'Mundart']],
        ],
      },
    ],
  },
  {
    name: 'Lo & Leduc',
    land: 'Schweiz',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Zucker fürs Volk',
        jahr: 2014,
        genres: ['Mundart', 'Pop'],
        songs: [
          ['Chansohn', '4:05'],
          ['All die Büecher', '4:06'],
          ['Blaui Peperoni', '3:50'],
          ['Streifgänger', '3:40', ['Mundart', 'Hip-Hop']],
          ['Bini bi dir', '3:28'],
          ['Magma im Arm', '5:12'],
          ['Jung verdammt', '4:09'],
          ['Pluto', '4:24'],
        ],
      },
      {
        titel: 'Update 4.0',
        jahr: 2018,
        genres: ['Mundart', 'Pop'],
        songs: [
          ['Lug wi mir flüge', '4:42'],
          ['079', '3:24'],
          ['Chileli vo Wasse', '3:32'],
          ['Ja genau', '4:32', ['Mundart', 'Hip-Hop']],
          ['Cuba Bar', '3:58'],
          ['Im erschte Tram', '3:24'],
          ['Risotto', '3:39'],
          ['Tupac', '3:27', ['Mundart', 'Hip-Hop']],
          ['Maradona', '3:51'],
        ],
      },
    ],
  },
  {
    name: 'Die Ärzte',
    land: 'Deutschland',
    gruendungsjahr: 1982,
    alben: [
      {
        titel: 'Die Bestie in Menschengestalt',
        jahr: 1993,
        genres: ['Punk', 'Rock'],
        songs: [
          ['Schrei nach Liebe', '4:12'],
          ['Schopenhauer', '3:06'],
          ['Für uns', '4:42'],
          ['Mach die Augen zu', '4:00', ['Rock']],
          ['Gehirn-Stürm', '4:04'],
          ['Friedenspanzer', '3:56'],
          ['Quark', '2:45'],
          ['Dos corazones', '3:47'],
          ['Lieber Tee', '4:47'],
        ],
      },
      {
        titel: '13',
        jahr: 1998,
        genres: ['Punk', 'Rock'],
        songs: [
          ['Punk ist …', '3:42'],
          ['Ein Lied für dich', '2:43'],
          ['Goldenes Handwerk', '3:38'],
          ['½ Lovesong', '3:55', ['Rock']],
          ['Rebell', '3:54'],
          ['Männer sind Schweine', '4:18'],
          ['Liebe und Schmerz', '3:54'],
          ['Nie gesagt', '5:00', ['Rock']],
          ['Grotesksong', '3:52'],
        ],
      },
    ],
  },
  {
    name: 'Beyoncé',
    land: 'USA',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Beyoncé',
        jahr: 2013,
        genres: ['Pop', 'Soul'],
        songs: [
          ['Pretty Hurts', '4:17', ['Pop']],
          ['Haunted', '6:09', ['Pop', 'Elektro']],
          ['Drunk in Love', '5:23', ['Soul', 'Hip-Hop']],
          ['Partition', '5:19', ['Pop', 'Hip-Hop']],
          ['Jealous', '3:04'],
          ['XO', '3:35', ['Pop']],
          ['Flawless', '4:10', ['Hip-Hop', 'Pop']],
          ['Heaven', '3:50'],
        ],
      },
      {
        titel: 'Lemonade',
        jahr: 2016,
        genres: ['Pop', 'Soul'],
        songs: [
          ['Pray You Catch Me', '3:16'],
          ['Hold Up', '3:41', ['Pop']],
          ["Don't Hurt Yourself", '3:53', ['Rock', 'Soul']],
          ['Sorry', '3:52', ['Pop']],
          ['Daddy Lessons', '4:48', ['Folk', 'Pop']],
          ['Love Drought', '3:57'],
          ['Sandcastles', '3:02', ['Soul']],
          ['Freedom', '4:49', ['Soul', 'Hip-Hop']],
          ['Formation', '3:26', ['Hip-Hop', 'Pop']],
        ],
      },
    ],
  },
  {
    name: 'Helene Fischer',
    land: 'Deutschland',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Farbenspiel',
        jahr: 2013,
        genres: ['Schlager'],
        songs: [
          ['Fehlerfrei', '3:39'],
          ['Mit keinem Andern', '3:44'],
          ['So kann das Leben sein', '4:04'],
          ['Marathon', '3:49'],
          ['Atemlos durch die Nacht', '3:42', ['Schlager', 'Pop']],
          ['Te quiero', '3:40'],
          ['Captain meiner Seele', '3:39'],
          ['In diesen Nächten', '4:22'],
          ['Feuerwerk', '2:56', ['Schlager', 'Pop']],
          ['Ehrlich und klar', '4:05'],
        ],
      },
    ],
  },
  {
    name: 'Conchita Wurst',
    land: 'Österreich',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Conchita',
        jahr: 2015,
        genres: ['Pop'],
        songs: [
          ['You Are Unstoppable', '3:30'],
          ['Up for Air', '3:48'],
          ['Put That Fire Out', '3:42'],
          ['Colours of Your Love', '3:34'],
          ['Somebody to Love', '4:10', ['Pop', 'Soul']],
          ['Firestorm', '3:43'],
          ['Pure', '3:58'],
          ['Heroes', '3:43'],
          ['Rise like a Phoenix', '3:04'],
          ['The Other Side of Me', '3:41'],
        ],
      },
    ],
  },
  {
    name: 'Mahmood',
    land: 'Italien',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Gioventù bruciata',
        jahr: 2019,
        genres: ['Pop'],
        songs: [
          ['Soldi', '3:15', ['Pop', 'Hip-Hop']],
          ['Gioventù bruciata', '3:18'],
          ['Uramaki', '2:57', ['Pop', 'Hip-Hop']],
          ['Il Nilo nel Naviglio', '3:07'],
          ['Anni 90', '3:17'],
          ['Asia occidente', '3:49'],
          ['Remo', '3:08'],
          ['Milano Good Vibes', '2:58', ['Pop', 'Hip-Hop']],
          ['Sabbie mobili', '3:11'],
          ['Mai figlio unico', '2:59'],
        ],
      },
    ],
  },
  {
    name: 'Fabrizio De André',
    land: 'Italien',
    gruendungsjahr: null,
    alben: [
      {
        titel: 'Creuza de mä',
        jahr: 1984,
        genres: ['Folk'],
        songs: [
          ['Creuza de mä', '6:16'],
          ['Jamín-a', '4:52'],
          ['Sidún', '6:25'],
          ['Sinàn Capudàn Pascià', '5:32'],
          ['A pittima', '3:43'],
          ['A dumenega', '3:40'],
        ],
      },
    ],
  },
  {
    // Eurovision-Sieg 2024; im Katalog von kanti♪tunes (noch) ohne Album.
    name: 'Nemo',
    land: 'Schweiz',
    gruendungsjahr: null,
    alben: [],
  },
];

/** 'm:ss' in Sekunden. */
function sekunden(dauer: string): number {
  const [minuten, rest] = dauer.split(':');
  return Number(minuten) * 60 + Number(rest);
}

// ---------------------------------------------------------------------------
// Wortpools für Nutzer:innen und Playlists (frei erfunden)
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

/** Abo-Typen mit festem Preis (pro Typ genau ein Preis). Nur Einzelabos: ein
 * Familienabo bräuchte eine Zuordnung mehrerer Nutzer:innen zu einem Abo. */
const ABO_TYPEN: readonly (readonly [string, number, number])[] = [
  // [typ, preis, gewicht]
  ['Basic', 9.9, 35],
  ['Premium', 12.9, 30],
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

const ANZAHL_NUTZER = 25;
const ANZAHL_ABOS = 20;
const ANZAHL_PLAYLISTS = 50;
const ANZAHL_BEWERTUNGEN = 620;

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

  // --- kuenstler, album, song, song_genre (aus dem Katalog) -------------
  const genreId = new Map<string, number>(genre.map((g) => [g.name, g.id]));
  const kuenstler: Kuenstler[] = [];
  const album: Album[] = [];
  const song: Song[] = [];
  const songGenre: SongGenre[] = [];
  for (const k of KATALOG) {
    const kuenstlerId = kuenstler.length + 1;
    kuenstler.push({
      id: kuenstlerId,
      name: k.name,
      land: k.land,
      gruendungsjahr: k.gruendungsjahr,
    });
    for (const a of k.alben) {
      const albumId = album.length + 1;
      album.push({ id: albumId, titel: a.titel, erscheinungsjahr: a.jahr, kuenstlerId });
      for (const [titel, dauer, genres = a.genres] of a.songs) {
        const songId = song.length + 1;
        song.push({ id: songId, titel, dauerSek: sekunden(dauer), albumId });
        for (const name of genres) {
          songGenre.push({ songId, genreId: genreId.get(name)! });
        }
      }
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
    d.album.some((a) => d.song.filter((s) => s.albumId === a.id).length === 12),
    'kein Album mit genau 12 Songs',
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
  id       INTEGER PRIMARY KEY,
  song_id  INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
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
  id              INTEGER PRIMARY KEY,
  playlist_id     INTEGER NOT NULL,
  song_id         INTEGER NOT NULL,
  position        INTEGER NOT NULL,
  hinzugefuegt_am TEXT NOT NULL, -- ISO-Datum, z. B. '2023-04-17'
  FOREIGN KEY (playlist_id) REFERENCES playlist (id),
  FOREIGN KEY (song_id) REFERENCES song (id)
);

CREATE TABLE bewertung (
  id        INTEGER PRIMARY KEY,
  nutzer_id INTEGER NOT NULL,
  song_id   INTEGER NOT NULL,
  sterne    INTEGER NOT NULL CHECK (sterne BETWEEN 1 AND 5),
  datum     TEXT NOT NULL, -- ISO-Datum, z. B. '2023-04-17'
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
      ['id', 'song_id', 'genre_id'],
      d.songGenre.map((sg, i) => [i + 1, sg.songId, sg.genreId]),
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
      ['id', 'playlist_id', 'song_id', 'position', 'hinzugefuegt_am'],
      d.playlistSong.map((ps, i) => [
        i + 1,
        ps.playlistId,
        ps.songId,
        ps.position,
        ps.hinzugefuegtAm,
      ]),
    ),
    insertBloecke(
      'bewertung',
      ['id', 'nutzer_id', 'song_id', 'sterne', 'datum'],
      d.bewertung.map((b, i) => [i + 1, b.nutzerId, b.songId, b.sterne, b.datum]),
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
    '-- k♪t Musik-Streaming, Beispieldatenbank der LPU «Datenmodellierung und Datenbanken»',
    `-- Generiert von scripts/generate-seed.ts (Seed ${GENERATOR_SEED}, Version ${SEED_VERSION}). Nicht von Hand editieren.`,
    '-- Streaming-Dienst «kanti♪tunes». Künstler:innen, Alben und Songs sind echt (Auswahl, Angaben nach',
    '-- Wikipedia und MusicBrainz). Nutzer:innen, Abos, Playlists und Bewertungen sind frei erfunden.',
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
