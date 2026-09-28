import { mdiFileDocumentOutline, mdiPlus, mdiTableLarge } from '@mdi/js';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import { useDbStore } from '@/store/dbStore';
import { useScratchbookStore } from '@/store/scratchbookStore';
import { scratchbookTabId, tableTabId, useUiStore } from '@/store/uiStore';
import styles from './SidePanel.module.css';

/** Seitenleiste mit Tabellen und Scratch-Books. `onNavigate` schliesst den Drawer. */
export function SidePanel({ onNavigate }: { onNavigate?: () => void }) {
  const tables = useDbStore((state) => state.tables);
  const scratchbooks = useScratchbookStore((state) => state.list);
  const openScratchbook = useScratchbookStore((state) => state.open);
  const createScratchbook = useScratchbookStore((state) => state.create);
  const openTable = useUiStore((state) => state.openTable);
  const activeTabId = useUiStore((state) => state.activeTabId);

  return (
    <nav className={styles.panel} aria-label={de.sidebar.label}>
      <section className={styles.section} aria-labelledby="sidepanel-tables">
        <h2 id="sidepanel-tables" className={styles.heading}>
          {de.sidebar.tables}
        </h2>
        {tables.length === 0 ? (
          <p className={styles.empty}>{de.sidebar.noTables}</p>
        ) : (
          <ul className={styles.list}>
            {tables.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className={styles.item}
                  aria-current={activeTabId === tableTabId(name) ? 'page' : undefined}
                  onClick={() => {
                    openTable(name);
                    onNavigate?.();
                  }}
                >
                  <Icon path={mdiTableLarge} size={18} />
                  <span className={styles.itemText}>{name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="sidepanel-scratchbooks">
        <div className={styles.headingRow}>
          <h2 id="sidepanel-scratchbooks" className={styles.heading}>
            {de.sidebar.scratchbooks}
          </h2>
          <button
            type="button"
            className={styles.newButton}
            aria-label={de.sidebar.newScratchbookLabel}
            onClick={() => {
              void createScratchbook().then(() => onNavigate?.());
            }}
          >
            <Icon path={mdiPlus} size={18} />
            <span>{de.sidebar.newScratchbook}</span>
          </button>
        </div>
        {scratchbooks.length === 0 ? (
          <p className={styles.empty}>{de.sidebar.noScratchbooks}</p>
        ) : (
          <ul className={styles.list}>
            {scratchbooks.map((item) => (
              <li key={item.id}>
                {/* TODO(Phase D): «⋯»-Menü mit Umbenennen, Herunterladen, Löschen. */}
                <button
                  type="button"
                  className={styles.item}
                  aria-current={activeTabId === scratchbookTabId(item.id) ? 'page' : undefined}
                  onClick={() => {
                    void openScratchbook(item.id).then(() => onNavigate?.());
                  }}
                >
                  <Icon path={mdiFileDocumentOutline} size={18} />
                  <span className={styles.itemText}>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </nav>
  );
}
