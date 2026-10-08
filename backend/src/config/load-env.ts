import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

export const backendDirectory = fileURLToPath(new URL('../../', import.meta.url));

export function loadBackendEnv() {
  config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
}
