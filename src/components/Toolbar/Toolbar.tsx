import {
  mdiClose,
  mdiDatabaseOutline,
  mdiDotsHorizontal,
  mdiHelpCircleOutline,
  mdiMenu,
  mdiRestore,
} from '@mdi/js';
import { useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { MessageDialog } from '@/components/dialogs/MessageDialog';
import { NewDatabaseDialog } from '@/components/dialogs/NewDatabaseDialog';
import { HelpDialog } from '@/components/Help/HelpDialog';
import { Menu, type MenuItem } from '@/components/Menu/Menu';
import { Icon } from '@/components/Shell/Icon';
import { pickFile, readFileBytes } from '@/files/openFile';
import { de } from '@/i18n/de';
import { useDbStore } from '@/store/dbStore';
import { useUiStore } from '@/store/uiStore';
import { StorageNotice } from './StorageNotice';
import styles from './Toolbar.module.css';

const SQLITE_ACCEPT = '.sqlite,.db,.sqlite3,application/vnd.sqlite3,application/x-sqlite3';
const TOAST_MS = 3500;

type OpenDialog =
  | { kind: 'new' }
  | { kind: 'reset' }
  | { kind: 'delete'; id: string; name: string }
  | { kind: 'message'; title: string; text: string }
  | { kind: 'help' };

const messageOf = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : de.dialogs.actionFailed;

export function Toolbar({ showSidebarToggle }: { showSidebarToggle: boolean }) {
  const selectId = useId();
  const databases = useDbStore((state) => state.databases);
  const activeDbId = useDbStore((state) => state.activeDbId);
  const switchDatabase = useDbStore((state) => state.switchDatabase);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const active = databases.find((db) => db.id === activeDbId);
  const builtin = active?.kind === 'builtin';

  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (text: string) => {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  useEffect(
    () => () => {
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    },
    [],
  );

  const closeDialog = () => setDialog(null);

  const importDatabase = async () => {
    const file = await pickFile(SQLITE_ACCEPT);
    if (!file) return;
    try {
      const meta = await useDbStore
        .getState()
        .importSqliteFile(file.name, await readFileBytes(file));
      showToast(de.toolbar.dbImported(meta.name));
    } catch (error) {
      setDialog({ kind: 'message', title: de.dialogs.importFailedTitle, text: messageOf(error) });
    }
  };

  const downloadDatabase = async () => {
    try {
      await useDbStore.getState().downloadActive();
    } catch (error) {
      setDialog({ kind: 'message', title: de.dialogs.actionFailed, text: messageOf(error) });
    }
  };

  const userDb = active?.kind === 'user' ? active : undefined;
  const menuItems: MenuItem[] = [
    { id: 'new', label: de.toolbar.newDatabase, onSelect: () => setDialog({ kind: 'new' }) },
    { id: 'import', label: de.toolbar.importDatabase, onSelect: () => void importDatabase() },
    { id: 'download', label: de.toolbar.downloadDatabase, onSelect: () => void downloadDatabase() },
    ...(userDb
      ? [
          {
            id: 'delete',
            label: de.toolbar.deleteDatabase,
            danger: true,
            onSelect: () => setDialog({ kind: 'delete', id: userDb.id, name: userDb.name }),
          },
        ]
      : []),
  ];

  return (
    <>
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
          <Menu label={de.toolbar.dbActions} items={menuItems} buttonClassName={styles.iconButton}>
            <Icon path={mdiDotsHorizontal} />
          </Menu>
        </div>

        <div className={styles.resetGroup}>
          <button
            type="button"
            className={styles.textButton}
            disabled={!builtin}
            title={builtin ? de.toolbar.resetTitle : de.toolbar.resetOnlyBuiltin}
            onClick={() => setDialog({ kind: 'reset' })}
          >
            <Icon path={mdiRestore} size={20} />
            <span>{de.toolbar.reset}</span>
          </button>
          {builtin && active.seedOutdated && (
            <button
              type="button"
              className={styles.badge}
              title={de.toolbar.seedOutdatedTitle}
              onClick={() => setDialog({ kind: 'reset' })}
            >
              {de.toolbar.seedOutdated}
            </button>
          )}
        </div>

        <span className={styles.spacer} />

        <button
          type="button"
          className={styles.iconButton}
          aria-label={de.toolbar.help}
          title={de.toolbar.help}
          aria-haspopup="dialog"
          onClick={() => setDialog({ kind: 'help' })}
        >
          <Icon path={mdiHelpCircleOutline} />
        </button>

        <div
          className={styles.toast}
          role="status"
          aria-live="polite"
          data-visible={toast !== null || undefined}
        >
          {toast}
        </div>
      </header>

      <StorageNotice />

      {dialog?.kind === 'new' && (
        <NewDatabaseDialog
          onClose={closeDialog}
          onCreated={(name) => showToast(de.toolbar.dbCreated(name))}
        />
      )}
      {dialog?.kind === 'reset' && (
        <ConfirmDialog
          title={de.dialogs.resetDb.title}
          text={de.dialogs.resetDb.text}
          note={active?.seedOutdated ? de.dialogs.resetDb.outdated : undefined}
          confirmLabel={de.dialogs.resetDb.confirm}
          danger
          onConfirm={async () => {
            await useDbStore.getState().resetBuiltin();
            showToast(de.toolbar.resetDone);
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={de.dialogs.deleteDb.title}
          text={de.dialogs.deleteDb.text(dialog.name)}
          confirmLabel={de.dialogs.deleteDb.confirm}
          danger
          onConfirm={async () => {
            await useDbStore.getState().deleteDatabase(dialog.id);
            showToast(de.toolbar.dbDeleted(dialog.name));
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'message' && (
        <MessageDialog title={dialog.title} text={dialog.text} onClose={closeDialog} />
      )}
      {dialog?.kind === 'help' && <HelpDialog onClose={closeDialog} />}
    </>
  );
}
