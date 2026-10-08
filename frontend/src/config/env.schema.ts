import { z } from 'zod';

const frontendEnvSchema = z.object({
  VITE_API_URL: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//.test(value), {
      message: 'Debe ser una URL HTTP o HTTPS.',
    }),
});

export function parseFrontendEnv(source: Record<string, unknown>) {
  const result = frontendEnvSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuración del frontend inválida. Revisa frontend/.env y .env.example.\n${details}`,
    );
  }

  return result.data;
}
