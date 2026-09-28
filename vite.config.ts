import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  base: '/dmdb_app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'baseline-widely-available',
    rolldownOptions: {
      output: {
        // Grosse, selten ändernde Bibliotheken in eigene Chunks: kein Chunk über 500 kB,
        // und nach einem App-Update bleiben sie im Browser-Cache gültig.
        codeSplitting: {
          groups: [
            {
              name: 'codemirror',
              test: /node_modules[\\/](@codemirror|@lezer|codemirror|crelt|style-mod|w3c-keyname)[\\/]/,
            },
            { name: 'sqljs', test: /node_modules[\\/]sql\.js[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
