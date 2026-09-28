import { mdiClose, mdiDatabaseOutline, mdiHelpCircleOutline, mdiMenu, mdiRestore } from '@mdi/js';
import { useId } from 'react';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import { useDbStore } from '@/store/dbStore';
import { useUiStore } from '@/store/uiStore';
import styles from './Toolbar.module.css';

export function Toolbar({ showSidebarToggle }: { showSidebarToggle: boolean }) {
  const selectId = useId();
  const databases = useDbStore((state) => state.databases);
  const activeDbId = useDbStore((state) => state.activeDbId);
  const switchDatabase = useDbStore((state) => state.switchDatabase);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const active = databases.find((db) => db.id === activeDbId);

  return (
    <header className={styles.toolbar}>
      {showSidebarToggle && (
        <button
          type="button"
          className={styles.iconButton}
          aria-label={sidebarOpen ? de.toolbar.closeSidebar : de.toolbar.openSidebar}
          aria-expanded={sidebarOpen}
          aria-controls="sidepanel"
          onClick={toggleSidebar}
        >
          <Icon path={sidebarOpen ? mdiClose : mdiMenu} />
        </button>
      )}

      <h1 className={styles.title}>
        <Icon path={mdiDatabaseOutline} />
        <span>{de.app.title}</span>
      </h1>

      <div className={styles.dbPicker}>
        <label htmlFor={selectId} className={styles.dbLabel}>
          {de.toolbar.database}
        </label>
        <select
          id={selectId}
          className={styles.select}
          value={activeDbId ?? ''}
          onChange={(event) => void switchDatabase(event.target.value)}
        >
          {databases.map((db) => (
            <option key={db.id} value={db.id}>
              {db.name}
            </option>
          ))}
        </select>
      </div>

      {/* TODO(Phase D): Bestätigungsdialog und `useDbStore.resetBuiltin()` anschliessen. */}
      {active?.kind === 'builtin' && (
        <button
          type="button"
          className={styles.textButton}
          disabled
          title={`${de.toolbar.resetTitle} (${de.toolbar.comingSoon})`}
        >
          <Icon path={mdiRestore} size={20} />
          <span>{de.toolbar.reset}</span>
        </button>
      )}

      <span className={styles.spacer} />

      {/* TODO(Phase D): Hilfe-Dialog (SQL-Spickzettel). */}
      <button
        type="button"
        className={styles.iconButton}
        aria-label={de.toolbar.help}
        title={de.toolbar.comingSoon}
        disabled
      >
        <Icon path={mdiHelpCircleOutline} />
      </button>
    </header>
  );
}
