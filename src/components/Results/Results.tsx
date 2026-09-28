import { mdiCheckCircleOutline } from '@mdi/js';
import type { StatementResult } from '@/db';
import { Icon } from '@/components/Shell/Icon';
import { de } from '@/i18n/de';
import { EMPTY_TAB_RESULTS, useResultStore } from '@/store/resultStore';
import { ErrorBox } from './ErrorBox';
import { ResultTable } from './ResultTable';
import { summaryText } from './resultText';
import styles from './Results.module.css';

interface ResultsProps {
  tabId: string;
  /** Markiert den Bereich eines Statements im Editor. */
  onShowRange?: (range: [number, number]) => void;
}

/** Ausgabe eines Editor-Tabs: pro Statement ein Block. */
export function Results({ tabId, onShowRange }: ResultsProps) {
  const tab = useResultStore((state) => state.byTab[tabId] ?? EMPTY_TAB_RESULTS);
  const { results } = tab;
  // Eine einzelne Resultattabelle füllt die Ausgabe, damit ihr Kopf beim Scrollen stehen bleibt.
  const single = results.length === 1 && results[0]?.kind === 'rows';

  return (
    <section
      className={styles.output}
      aria-label={de.results.label}
      aria-busy={tab.running}
      data-single={single || undefined}
    >
      {tab.persistError && (
        <ErrorBox
          error={{
            ...tab.persistError,
            title: de.results.persistFailed,
            hint: tab.persistError.title,
          }}
          afterOthers={false}
        />
      )}
      {tab.ranAt === undefined ? (
        <p className={styles.empty}>{de.results.empty}</p>
      ) : results.length === 0 ? (
        <p className={styles.empty}>{de.results.noStatements}</p>
      ) : (
        results.map((result, index) => (
          <ResultBlock
            key={`${tab.ranAt}-${index}`}
            result={result}
            index={index}
            onShowRange={onShowRange}
          />
        ))
      )}
    </section>
  );
}

function ResultBlock({
  result,
  index,
  onShowRange,
}: {
  result: StatementResult;
  index: number;
  onShowRange?: (range: [number, number]) => void;
}) {
  return (
    <article className={styles.block} data-kind={result.kind}>
      <pre className={styles.statement} aria-label={de.results.statementLabel}>
        {result.sql.trim()}
      </pre>
      {result.kind === 'error' ? (
        <ErrorBox
          error={result.error}
          afterOthers={index > 0}
          onShow={onShowRange ? () => onShowRange(result.range) : undefined}
        />
      ) : (
        <>
          <p className={styles.summary}>
            <Icon path={mdiCheckCircleOutline} size={18} />
            <span className={styles.summaryText}>{summaryText(result)}</span>
            <span className={styles.duration}>{de.results.duration(result.ms)}</span>
          </p>
          {result.kind === 'rows' && (
            <>
              {result.truncated && (
                <p className={styles.note}>{de.results.truncated(result.rows.length)}</p>
              )}
              {result.columns.length > 0 && (
                <ResultTable columns={result.columns} rows={result.rows} />
              )}
            </>
          )}
        </>
      )}
    </article>
  );
}
