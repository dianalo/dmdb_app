import {
  mdiDotsHorizontal,
  mdiFileDocumentOutline,
  mdiFolderOpenOutline,
  mdiPlus,
  mdiTableLarge,
} from '@mdi/js';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { MessageDialog } from '@/components/dialogs/MessageDialog';
import { PromptDialog } from '@/components/dialogs/PromptDialog';
import { Menu } from '@/components/Menu/Menu';
import { Icon } from '@/components/Shell/Icon';
import { pickFile, readFileText } from '@/files/openFile';
import { de } from '@/i18n/de';
import { useDbStore } from '@/store/dbStore';
import { isNameTaken } from '@/store/names';
import { useScratchbookStore, type ScratchbookSummary } from '@/store/scratchbookStore';
import { scratchbookTabId, tableTabId, useUiStore } from '@/store/uiStore';
import styles from './SidePanel.module.css';

const SQL_ACCEPT = '.sql,.txt,text/plain';

type OpenDialog =
  | { kind: 'rename'; item: ScratchbookSummary }
  | { kind: 'delete'; item: ScratchbookSummary }
  | { kind: 'message'; title: string; text: string };

/** Seitenleiste mit Tabellen und Scratch-Books. `onNavigate` schliesst den Drawer. */
export function SidePanel({ onNavigate }: { onNavigate?: () => void }) {
  const tables = useDbStore((state) => state.tables);
  const scratchbooks = useScratchbookStore((state) => state.list);
  const openScratchbook = useScratchbookStore((state) => state.open);
  const createScratchbook = useScratchbookStore((state) => state.create);
  const openTable = useUiStore((state) => state.openTable);
  const activeTabId = useUiStore((state) => state.activeTabId);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const closeDialog = () => setDialog(null);

  const openFromFile = async () => {
    const file = await pickFile(SQL_ACCEPT);
    if (!file) return;
    try {
      const content = await readFileText(file);
      await useScratchbookStore.getState().createFromFile(file.name, content);
      onNavigate?.();
    } catch {
      setDialog({
        kind: 'message',
        title: de.scratchbooks.openFailedTitle,
        text: de.scratchbooks.openFailed,
      });
    }
  };

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
          <div className={styles.headingActions}>
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
            <button
              type="button"
              className={styles.newButton}
              aria-label={de.sidebar.openScratchbookLabel}
              onClick={() => void openFromFile()}
            >
              <Icon path={mdiFolderOpenOutline} size={18} />
              <span>{de.sidebar.openScratchbook}</span>
            </button>
          </div>
        </div>
        {scratchbooks.length === 0 ? (
          <p className={styles.empty}>{de.sidebar.noScratchbooks}</p>
        ) : (
          <ul className={styles.list}>
            {scratchbooks.map((item) => {
              const current = activeTabId === scratchbookTabId(item.id);
              return (
                <li key={item.id} className={styles.row} data-current={current || undefined}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => {
                      void openScratchbook(item.id).then(() => onNavigate?.());
                    }}
                  >
                    <Icon path={mdiFileDocumentOutline} size={18} />
                    <span className={styles.itemText}>{item.name}</span>
                  </button>
                  <Menu
                    label={de.sidebar.itemActions(item.name)}
                    buttonClassName={styles.moreButton}
                    align="end"
                    items={[
                      {
                        id: 'rename',
                        label: de.scratchbooks.rename,
                        onSelect: () => setDialog({ kind: 'rename', item }),
                      },
                      {
                        id: 'download',
                        label: de.scratchbooks.download,
                        onSelect: () =>
                          void useScratchbookStore
                            .getState()
                            .download(item.id)
                            .catch(() =>
                              setDialog({
                                kind: 'message',
                                title: de.dialogs.actionFailed,
                                text: de.scratchbooks.downloadFailed,
                              }),
                            ),
                      },
                      {
                        id: 'delete',
                        label: de.scratchbooks.delete,
                        danger: true,
                        onSelect: () => setDialog({ kind: 'delete', item }),
                      },
                    ]}
                  >
                    <Icon path={mdiDotsHorizontal} size={20} />
                  </Menu>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialog?.kind === 'rename' && (
        <PromptDialog
          title={de.scratchbooks.renameTitle}
          label={de.dialogs.nameLabel}
          initialValue={dialog.item.name}
          confirmLabel={de.dialogs.save}
          validate={(value) => {
            if (!value) return de.dialogs.nameRequired;
            const others = useScratchbookStore
              .getState()
              .list.filter((entry) => entry.id !== dialog.item.id)
              .map((entry) => entry.name);
            return isNameTaken(value, others) ? de.dialogs.scratchbookNameTaken(value) : null;
          }}
          onSubmit={(value) => useScratchbookStore.getState().rename(dialog.item.id, value)}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={de.scratchbooks.deleteTitle}
          text={de.scratchbooks.deleteText(dialog.item.name)}
          confirmLabel={de.scratchbooks.delete}
          danger
          onConfirm={() => useScratchbookStore.getState().remove(dialog.item.id)}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'message' && (
        <MessageDialog title={dialog.title} text={dialog.text} onClose={closeDialog} />
      )}
    </nav>
  );
}
