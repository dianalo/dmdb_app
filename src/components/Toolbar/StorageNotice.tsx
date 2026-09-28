import { mdiInformationOutline } from '@mdi/js';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import { getSetting, patchSettings } from '@/persistence';
import styles from './Toolbar.module.css';

/** Einmaliger Hinweis, dass alles nur lokal im Browser liegt. */
export function StorageNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSetting('storageNoticeSeen')
      .then((seen) => {
        if (!cancelled && !seen) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.notice} role="note">
      <Icon path={mdiInformationOutline} size={20} />
      <p className={styles.noticeText}>{de.toolbar.storageNotice}</p>
      <button
        type="button"
        className={styles.noticeButton}
        onClick={() => {
          setVisible(false);
          void patchSettings({ storageNoticeSeen: true }).catch(() => undefined);
        }}
      >
        {de.toolbar.storageNoticeOk}
      </button>
    </div>
  );
}
