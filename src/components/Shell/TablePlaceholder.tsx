import { mdiTableLarge } from '@mdi/js';
import { de } from '@/i18n/de';
import { Icon } from './Icon';
import styles from './Shell.module.css';

/** Platzhalter für den Tabellen-Tab. TODO(Phase D): Tabellenansicht mit Daten und DDL. */
export function TablePlaceholder({ name }: { name: string }) {
  return (
    <div className={styles.placeholder}>
      <Icon path={mdiTableLarge} size={40} />
      <h2>{name}</h2>
      <p>{de.tableView.placeholder}</p>
      <p className={styles.placeholderHint}>{de.tableView.placeholderHint(name)}</p>
    </div>
  );
}
