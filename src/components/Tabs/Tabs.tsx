import { mdiClose, mdiPlus } from '@mdi/js';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import { useScratchbookStore } from '@/store/scratchbookStore';
import { SQL_TAB_ID, tabButtonId, tabPanelId, useUiStore } from '@/store/uiStore';
import styles from './Tabs.module.css';

export function Tabs() {
  const tabs = useUiStore((state) => state.tabs);
  const activeTabId = useUiStore((state) => state.activeTabId);
  const activate = useUiStore((state) => state.activate);
  const closeTab = useUiStore((state) => state.closeTab);
  const createScratchbook = useScratchbookStore((state) => state.create);
  const barRef = useRef<HTMLDivElement>(null);

  // Den aktiven Tab in den sichtbaren Bereich der scrollbaren Leiste holen.
  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLElement>(
      `[data-tab-id="${CSS.escape(activeTabId)}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  // Pfeiltasten wechseln zwischen den Tabs (ARIA-Tabs-Muster).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = tabs.findIndex((tab) => tab.id === activeTabId);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (!next) return;
    event.preventDefault();
    activate(next.id);
    document.getElementById(tabButtonId(next.id))?.focus();
  };

  return (
    <div className={styles.bar} ref={barRef}>
      <div role="tablist" aria-label={de.tabs.label} className={styles.list} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={styles.tab}
              data-selected={selected || undefined}
              data-tab-id={tab.id}
            >
              <button
                type="button"
                role="tab"
                id={tabButtonId(tab.id)}
                aria-selected={selected}
                aria-controls={tabPanelId(tab.id)}
                tabIndex={selected ? 0 : -1}
                className={styles.tabButton}
                onClick={() => activate(tab.id)}
              >
                {tab.title}
              </button>
              {tab.id !== SQL_TAB_ID && (
                <button
                  type="button"
                  className={styles.close}
                  aria-label={de.tabs.close(tab.title)}
                  onClick={() => closeTab(tab.id)}
                >
                  <Icon path={mdiClose} size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.add}
        aria-label={de.tabs.newScratchbook}
        title={de.tabs.newScratchbook}
        onClick={() => void createScratchbook()}
      >
        <Icon path={mdiPlus} size={20} />
      </button>
    </div>
  );
}
