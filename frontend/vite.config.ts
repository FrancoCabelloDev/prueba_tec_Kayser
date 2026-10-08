import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { parseFrontendEnv } from './src/config/env.schema.ts';

const frontendDirectory = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  parseFrontendEnv({ ...loadEnv(mode, frontendDirectory, 'VITE_'), ...process.env });

  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true },
  };
});
