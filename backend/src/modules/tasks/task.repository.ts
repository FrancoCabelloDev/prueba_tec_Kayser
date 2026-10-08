import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import type { TeamMemberSummary } from '../team-members/team-member.repository.js';

const publicTaskFields = {
  id: true,
  title: true,
  description: true,
  responsibleId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  responsible: { select: { id: true, code: true, name: true, isActive: true } },
} satisfies Prisma.TaskSelect;
type TaskWriteData = Pick<
  Prisma.TaskUncheckedCreateInput,
  'title' | 'description' | 'responsibleId' | 'status'
>;
export type AssignmentValidator = (
  member: TeamMemberSummary | null,
  currentResponsibleId?: number,
) => void;

export const taskRepository = {
  list() {
    return prisma.task.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: publicTaskFields,
    });
  },
  create(data: TaskWriteData, validate: AssignmentValidator) {
    return prisma.$transaction(async (transaction) => {
      const member = await transaction.teamMember.findUnique({ where: { id: data.responsibleId } });
      validate(member);
      return transaction.task.create({ data, select: publicTaskFields });
    });
  },
  async update(id: number, data: TaskWriteData, validate: AssignmentValidator) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const current = await transaction.task.findUnique({
          where: { id },
          select: { responsibleId: true },
        });
        if (!current) return null;
        const member = await transaction.teamMember.findUnique({
          where: { id: data.responsibleId },
        });
        validate(member, current.responsibleId);
        return transaction.task.update({ where: { id }, data, select: publicTaskFields });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  },
  async delete(id: number) {
    try {
      return await prisma.task.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  },
};
