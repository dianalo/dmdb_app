import { de } from '@/i18n/de';

export default function App() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-muted)',
      }}
    >
      {de.app.loading}
    </div>
  );
}
