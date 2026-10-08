import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    env: { VITE_API_URL: 'http://127.0.0.1:3000/api' },
    restoreMocks: true,
    unstubGlobals: true,
  },
});
