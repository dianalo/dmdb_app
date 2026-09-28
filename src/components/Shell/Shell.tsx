import { useEffect } from 'react';
import { EditorTab } from '@/components/Editor/EditorTab';
import { SidePanel } from '@/components/SidePanel/SidePanel';
import { Tabs } from '@/components/Tabs/Tabs';
import { Toolbar } from '@/components/Toolbar/Toolbar';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { tabButtonId, tabPanelId, useUiStore } from '@/store/uiStore';
import { TablePlaceholder } from './TablePlaceholder';
import styles from './Shell.module.css';

/**
 * Grundlayout: Toolbar oben, Seitenleiste links (ab 1024 px fix, darunter Drawer),
 * Hauptbereich mit Tabs. Die Seite selbst scrollt nie, nur die einzelnen Bereiche.
 */
export function Shell() {
  const desktop = useBreakpoint() === 'desktop';
  const tabs = useUiStore((state) => state.tabs);
  const activeTabId = useUiStore((state) => state.activeTabId);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const drawerOpen = !desktop && sidebarOpen;

  // Escape schliesst den Drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, setSidebarOpen]);

  const closeDrawer = desktop ? undefined : () => setSidebarOpen(false);

  return (
    <div className={styles.shell}>
      <Toolbar showSidebarToggle={!desktop} />
      <div className={styles.body}>
        {desktop ? (
          <aside id="sidepanel" className={styles.sidebar}>
            <SidePanel />
          </aside>
        ) : (
          <>
            <div
              className={styles.backdrop}
              data-open={drawerOpen || undefined}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <aside
              id="sidepanel"
              className={styles.drawer}
              data-open={drawerOpen || undefined}
              inert={!drawerOpen}
            >
              <SidePanel onNavigate={closeDrawer} />
            </aside>
          </>
        )}
        <main className={styles.main}>
          <Tabs />
          <div className={styles.panels}>
            {tabs.map((tab) => {
              const active = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  id={tabPanelId(tab.id)}
                  role="tabpanel"
                  aria-labelledby={tabButtonId(tab.id)}
                  className={styles.panel}
                  hidden={!active}
                >
                  {tab.kind === 'table' ? (
                    <TablePlaceholder name={tab.refId ?? tab.title} />
                  ) : (
                    // Editor-Tabs bleiben gemountet, damit Verlauf und Cursor erhalten bleiben.
                    <EditorTab tab={tab} active={active} />
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
