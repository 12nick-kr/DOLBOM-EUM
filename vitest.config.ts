import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    // transcribe route test builds a real multipart/form-data body and relies on Node's undici
    // Request/FormData parser; jsdom's own Blob/File globals are not recognized by undici's
    // webidl checks and make formData() throw regardless of a well-formed body. Run that one
    // file under the `node` environment instead so it exercises the real runtime parser.
    environmentMatchGlobs: [['tests/transcribe-route.test.ts', 'node']],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
