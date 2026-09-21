/**
 * Öffentliche Schnittstelle der Datenschicht.
 * Der Rest der App importiert ausschliesslich von hier, nie direkt von sql.js.
 */
export { createEngine } from './engine';
export type { Engine } from './engine';
export { loadSqlJs } from './sqljs';
export { runScript } from './runScript';
export {
  DML_KEYWORDS,
  READ_ONLY_KEYWORDS,
  ddlVerb,
  effectiveKeyword,
  firstKeyword,
  schemaVersion,
} from './classify';
export {
  columnNames,
  errorContext,
  listTables,
  quoteIdent,
  rowCount,
  tableColumns,
  tableDdl,
  tableInfo,
} from './schema';
export { escapeLike, pageTable } from './browse';
export { SqlError, translateError, translateThrown } from './errors/translate';
export { RULES } from './errors/rules';
export type { Rule, RuleResult } from './errors/rules';
export { closestMatch, levenshtein } from './errors/levenshtein';
export { SQL_FUNCTIONS, SQL_KEYWORDS } from './errors/keywords';
export { ROW_CAP } from './types';
export type {
  ColumnInfo,
  ErrorContext,
  PageRequest,
  PageResult,
  RunOutcome,
  SortDirection,
  SqlValue,
  StatementResult,
  TableInfo,
  TranslatedError,
} from './types';
