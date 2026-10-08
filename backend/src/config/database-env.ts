import { resolve } from 'node:path';
import { z } from 'zod';
import { backendDirectory, loadBackendEnv } from './load-env.js';

loadBackendEnv();

const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .refine(
      (value) =>
        value.startsWith('file:') &&
        !value.startsWith('file://') &&
        value.slice(5).trim().length > 0 &&
        value !== 'file::memory:' &&
        !/[?#]/.test(value) &&
        !value.includes('\u0000'),
      { message: 'Debe indicar un archivo SQLite con file:, por ejemplo file:./prisma/dev.db.' },
    ),
});

const result = databaseEnvSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Configuración de base de datos inválida. Revisa DATABASE_URL en backend/.env.\n${result.error.issues.map((issue) => issue.message).join('\n')}`,
  );
}

// CLI and application resolve the file against the same base directory.
const databasePath = resolve(backendDirectory, result.data.DATABASE_URL.slice(5));

export const databaseEnv = {
  DATABASE_PATH: databasePath,
  DATABASE_URL: `file:${databasePath.replaceAll('\\', '/')}`,
};
