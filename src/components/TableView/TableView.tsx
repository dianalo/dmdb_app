import { mdiArrowDown, mdiArrowUp, mdiKeyVariant, mdiMagnify } from '@mdi/js';
import { useEffect, useRef, useState } from 'react';
import { DdlView } from '@/components/DdlView/DdlView';
import { ValueCell } from '@/components/Results/cells';
import resultStyles from '@/components/Results/Results.module.css';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import {
  DEFAULT_TABLE_VIEW,
  useTableViewStore,
  type TableViewData,
  type TableViewMode,
} from '@/store/tableViewStore';
import { SEARCH_DEBOUNCE_MS, ariaSort, counterText, isNumericType } from './tableViewLogic';
import styles from './TableView.module.css';

interface TableViewProps {
  name: string;
  active: boolean;
}

/**
 * Tabellen-Tab: Kopfzeile mit Name, Zeilenzahl, Suche und Umschalter «Daten | DDL»,
 * darunter die Daten (sortierbar, seitenweise) oder das `CREATE TABLE`.
 */
export function TableView({ name, active }: TableViewProps) {
  const view = useTableViewStore((state) => state.views[name] ?? DEFAULT_TABLE_VIEW);
  const dataVersion = useTableViewStore((state) => state.dataVersion);
  const refresh = useTableViewStore((state) => state.refresh);
  const setMode = useTableViewStore((state) => state.setMode);
  const setFilter = useTableViewStore((state) => state.setFilter);

  // Bei jeder Aktivierung und nach jeder Änderung an der Datenbank neu laden.
  useEffect(() => {
    if (active) void refresh(name);
  }, [active, dataVersion, name, refresh]);

  const [query, setQuery] = useState(view.filter);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const commitQuery = (value: string) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    void setFilter(name, value.trim());
  };

  const onQuery = (value: string) => {
    setQuery(value);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => commitQuery(value), SEARCH_DEBOUNCE_MS);
  };

  const missing = view.status === 'missing';

  return (
    <section className={styles.tableView} aria-label={name}>
      <header className={styles.header}>
        <h2 className={styles.title}>{name}</h2>
        {view.info && (
          <span className={styles.rowCount}>{de.tableView.rowCount(view.info.rowCount)}</span>
        )}
        {!missing && (
          <div className={styles.controls}>
            <label className={styles.search}>
              <Icon path={mdiMagnify} size={20} />
              <input
                type="search"
                value={query}
                placeholder={de.tableView.search}
                aria-label={de.tableView.searchLabel(name)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="search"
                onChange={(event) => onQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitQuery(query);
                }}
              />
            </label>
            <div className={styles.segmented} role="group" aria-label={de.tableView.modeLabel}>
              {(['data', 'ddl'] as TableViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view.mode === mode}
                  onClick={() => setMode(name, mode)}
                >
                  {de.tableView[mode]}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
      <TableViewBody name={name} view={view} />
    </section>
  );
}

function TableViewBody({ name, view }: { name: string; view: TableViewData }) {
  if (view.status === 'missing') {
    return <p className={styles.message}>{de.tableView.missing(name)}</p>;
  }
  if (view.status === 'error') {
    return (
      <div className={styles.message} role="alert">
        <p className={styles.errorTitle}>{de.tableView.loadFailed}</p>
        {view.error && <p>{view.error.title}</p>}
      </div>
    );
  }
  if (view.info === null) {
    return <p className={styles.message}>{de.tableView.loading}</p>;
  }
  if (view.mode === 'ddl') {
    return (
      <div className={styles.ddlPane}>
        <p className={styles.note}>{de.tableView.ddlNote}</p>
        <DdlView ddl={view.info.ddl} label={de.tableView.ddlLabel(name)} />
      </div>
    );
  }
  return <DataTable name={name} view={view} />;
}

function DataTable({ name, view }: { name: string; view: TableViewData }) {
  const toggleSort = useTableViewStore((state) => state.toggleSort);
  const loadMore = useTableViewStore((state) => state.loadMore);
  const columns = view.info?.columns ?? [];
  const empty = view.total === 0;

  return (
    <div className={styles.dataPane}>
      <div
        className={styles.scroll}
        tabIndex={0}
        role="region"
        aria-label={de.tableView.tableLabel(name)}
      >
        <table className={`${resultStyles.table} ${styles.table}`}>
          <thead>
            <tr>
              {columns.map((column) => {
                const sort = ariaSort(view.sort, column.name);
                const numeric = isNumericType(column.type);
                return (
                  <th
                    key={column.name}
                    scope="col"
                    aria-sort={sort}
                    data-numeric={numeric || undefined}
                  >
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => void toggleSort(name, column.name)}
                    >
                      {column.primaryKey && (
                        <span
                          className={styles.pk}
                          role="img"
                          aria-label={de.tableView.primaryKey}
                          title={de.tableView.primaryKey}
                        >
                          <Icon path={mdiKeyVariant} size={16} />
                        </span>
                      )}
                      <span>{column.name}</span>
                      <span className={styles.sortIcon}>
                        {sort === 'ascending' && <Icon path={mdiArrowUp} size={16} />}
                        {sort === 'descending' && <Icon path={mdiArrowDown} size={16} />}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((value, index) => (
                  <ValueCell key={index} value={value} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {empty && (
          <p className={styles.empty}>
            {view.filter !== '' ? de.tableView.noMatches : de.tableView.empty}
          </p>
        )}
      </div>
      {!empty && (
        <footer className={styles.footer}>
          <span className={styles.counter} aria-live="polite">
            {counterText(view.rows.length, view.total)}
          </span>
          {view.rows.length < view.total && (
            <button
              type="button"
              className={styles.moreButton}
              disabled={view.loadingMore}
              onClick={() => void loadMore(name)}
            >
              {de.tableView.loadMore}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
