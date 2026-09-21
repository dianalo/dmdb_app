import { describe, expect, it } from 'vitest';
import {
  DML_KEYWORDS,
  READ_ONLY_KEYWORDS,
  ddlVerb,
  effectiveKeyword,
  firstKeyword,
  skipTrivia,
  statementEnd,
} from './classify';

describe('firstKeyword', () => {
  it('liefert das Schlüsselwort in Grossbuchstaben', () => {
    expect(firstKeyword('select * from song')).toBe('SELECT');
  });

  it('überspringt Leerraum und Kommentare', () => {
    expect(firstKeyword('  -- Kommentar\n /* noch einer */\n\tINSERT INTO t VALUES (1)')).toBe(
      'INSERT',
    );
  });

  it('liefert für leere Eingabe einen leeren String', () => {
    expect(firstKeyword('')).toBe('');
    expect(firstKeyword('-- nur Kommentar')).toBe('');
    expect(firstKeyword('  ;  ')).toBe('');
  });
});

describe('effectiveKeyword', () => {
  it('sieht bei WITH die eigentliche Aktion auf oberster Ebene', () => {
    expect(effectiveKeyword('WITH x AS (SELECT 1) SELECT * FROM x')).toBe('SELECT');
    expect(
      effectiveKeyword('WITH x AS (SELECT 1) DELETE FROM song WHERE id IN (SELECT * FROM x)'),
    ).toBe('DELETE');
    expect(
      effectiveKeyword('WITH RECURSIVE x(n) AS (VALUES (1)) INSERT INTO t SELECT n FROM x'),
    ).toBe('INSERT');
  });

  it('lässt alle anderen Statements unverändert', () => {
    expect(effectiveKeyword('UPDATE song SET titel = titel')).toBe('UPDATE');
    expect(effectiveKeyword('PRAGMA table_info(song)')).toBe('PRAGMA');
  });
});

describe('statementEnd und skipTrivia', () => {
  it('ignoriert Semikolon in Strings, Bezeichnern und Kommentaren', () => {
    const sql = 'SELECT \'a;b\' AS "x;y" -- kommentar;\n, 1; SELECT 2';
    expect(sql.slice(0, statementEnd(sql))).toBe('SELECT \'a;b\' AS "x;y" -- kommentar;\n, 1;');
  });

  it('liefert das Ende der Eingabe, wenn kein Semikolon folgt', () => {
    expect(statementEnd('SELECT 1')).toBe(8);
  });

  it('springt über Leerraum und Kommentare zum ersten inhaltlichen Zeichen', () => {
    const sql = '  /* weg */ -- auch weg\n SELECT 1';
    expect(sql.slice(skipTrivia(sql))).toBe('SELECT 1');
  });
});

describe('Schlüsselwortlisten', () => {
  it('kennt die lesenden und die schreibenden Schlüsselwörter', () => {
    expect(READ_ONLY_KEYWORDS.has('SELECT')).toBe(true);
    expect(READ_ONLY_KEYWORDS.has('DELETE')).toBe(false);
    expect([...DML_KEYWORDS].sort()).toEqual(['DELETE', 'INSERT', 'REPLACE', 'UPDATE']);
  });

  it('ordnet DDL-Schlüsselwörter einem Verb zu', () => {
    expect(ddlVerb('create')).toBe('CREATE');
    expect(ddlVerb('DROP')).toBe('DROP');
    expect(ddlVerb('ALTER')).toBe('ALTER');
    expect(ddlVerb('VACUUM')).toBe('OTHER');
  });
});
