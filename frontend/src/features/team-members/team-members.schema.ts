import { z } from 'zod';

export const teamMemberSchema = z.strictObject({
  id: z.number().int().positive().max(2147483647),
  code: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean(),
});
export const activeTeamMemberListSchema = z
  .array(teamMemberSchema.extend({ isActive: z.literal(true) }))
  .refine(
    (members) =>
      new Set(members.map((member) => member.id)).size === members.length &&
      new Set(members.map((member) => member.code)).size === members.length,
  );
export type TeamMember = z.infer<typeof teamMemberSchema>;
