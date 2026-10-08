import { z } from 'zod';
import type { PrismaClient } from '../src/generated/prisma/client.js';

const catalogSchema = z
  .array(
    z.strictObject({
      code: z
        .string()
        .trim()
        .min(1, 'El código del integrante es obligatorio.')
        .max(30, 'El código no puede superar los 30 caracteres.')
        .regex(
          /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
          'Usa letras mayúsculas, números y guiones entre grupos.',
        ),
      name: z
        .string()
        .trim()
        .min(1, 'El nombre del integrante es obligatorio.')
        .max(100, 'El nombre no puede superar los 100 caracteres.'),
    }),
  )
  .min(1, 'El catálogo inicial debe contener al menos un integrante.')
  .superRefine((members, context) => {
    const codes = new Set<string>();
    members.forEach((member, index) => {
      if (codes.has(member.code)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'code'],
          message: `El código ${member.code} está repetido en el catálogo.`,
        });
      }
      codes.add(member.code);
    });
  });

export async function seedTeamMembers(prisma: PrismaClient, input: unknown) {
  // Validar el catálogo completo antes de escribir evita cargas parciales.
  const members = catalogSchema.parse(input);
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.teamMember.findMany({
      where: { code: { in: members.map((member) => member.code) } },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((member) => member.code));
    const missing = members.filter((member) => !existingCodes.has(member.code));
    if (missing.length === 0) return 0;
    const result = await transaction.teamMember.createMany({ data: missing });
    return result.count;
  });
}
