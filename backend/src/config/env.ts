import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const backendEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .regex(/^\d+$/, 'Debe ser un número entero.')
    .transform(Number)
    .refine((value) => Number.isInteger(value) && value >= 1 && value <= 65535, {
      message: 'Debe estar entre 1 y 65535.',
    }),
  FRONTEND_ORIGIN: z
    .string()
    .url()
    .refine(
      (value) => {
        try {
          return /^https?:\/\//.test(value) && new URL(value).origin === value;
        } catch {
          return false;
        }
      },
      { message: 'Debe ser un origen HTTP o HTTPS sin ruta ni barra final.' },
    ),
});

const result = backendEnvSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(
    `Configuración del backend inválida. Revisa backend/.env y .env.example.\n${details}`,
  );
}

export const env = result.data;
