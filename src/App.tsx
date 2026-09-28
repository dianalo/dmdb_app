import { useEffect } from 'react';
import { startApp } from '@/app/bootstrap';
import { Shell } from '@/components/Shell/Shell';
import styles from '@/components/Shell/Shell.module.css';
import { de } from '@/i18n/de';
import { useDbStore } from '@/store/dbStore';
import { useUiStore } from '@/store/uiStore';

export default function App() {
  const status = useDbStore((state) => state.status);
  const error = useDbStore((state) => state.error);
  // Erst nach dem Laden der gespeicherten Tabs rendern: die Editoren sind unkontrolliert.
  const hydrated = useUiStore((state) => state.hydrated);

  useEffect(() => {
    void startApp();
  }, []);

  if (status === 'error') {
    return (
      <div className={styles.status} role="alert">
        <h1 className={styles.statusTitle}>{de.app.errorTitle}</h1>
        <p className={styles.statusText}>{de.app.errorHint}</p>
        {error && <p className={styles.statusDetail}>{error}</p>}
        <button
          type="button"
          className={styles.reloadButton}
          onClick={() => window.location.reload()}
        >
          {de.app.reload}
        </button>
      </div>
    );
  }

  if (status !== 'ready' || !hydrated) {
    return (
      <div className={styles.status} role="status" aria-live="polite">
        {de.app.loading}
      </div>
    );
  }

  return <Shell />;
}
