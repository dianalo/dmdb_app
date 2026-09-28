import { mdiPlaylistPlus } from '@mdi/js';
import { Dialog } from '@/components/dialogs/Dialog';
import dialogStyles from '@/components/dialogs/Dialog.module.css';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import { insertIntoSqlTab } from './insertExample';
import styles from './HelpDialog.module.css';

/** SQL-Spickzettel mit Minimalbeispielen und kurzer Bedienungsanleitung. */
export function HelpDialog({ onClose }: { onClose(): void }) {
  const help = de.help;

  return (
    <Dialog
      title={help.title}
      size="wide"
      onClose={onClose}
      footer={
        <button
          type="button"
          className={`${dialogStyles.button} ${dialogStyles.primary}`}
          onClick={onClose}
        >
          {de.dialogs.close}
        </button>
      }
    >
      <p className={styles.intro}>{help.intro}</p>
      {help.sections.map((section) => (
        <section key={section.heading} className={styles.section}>
          <h3 className={styles.heading}>{section.heading}</h3>
          <dl className={styles.list}>
            {section.items.map((item) => (
              <div key={item.title} className={styles.entry}>
                <dt className={styles.term}>
                  <code>{item.title}</code>
                  {'additum' in item && item.additum && (
                    <span className={styles.additum}>{help.additum}</span>
                  )}
                </dt>
                <dd className={styles.description}>
                  <p>{item.text}</p>
                  <div className={styles.exampleRow}>
                    <pre className={styles.example}>
                      <code>{item.example}</code>
                    </pre>
                    <button
                      type="button"
                      className={styles.insertButton}
                      aria-label={help.insertLabel(item.title)}
                      onClick={() => {
                        onClose();
                        insertIntoSqlTab(item.example);
                      }}
                    >
                      <Icon path={mdiPlaylistPlus} size={20} />
                      <span>{help.insert}</span>
                    </button>
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section className={styles.section}>
        <h3 className={styles.heading}>{help.usageHeading}</h3>
        <ul className={styles.usage}>
          {help.usage.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </Dialog>
  );
}
