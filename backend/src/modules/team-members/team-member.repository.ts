import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

const publicFields = {
  id: true,
  code: true,
  name: true,
  isActive: true,
} satisfies Prisma.TeamMemberSelect;

export type TeamMemberSummary = Prisma.TeamMemberGetPayload<{ select: typeof publicFields }>;

export const teamMemberRepository = {
  listActive(): Promise<TeamMemberSummary[]> {
    return prisma.teamMember.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select: publicFields,
    });
  },
};
