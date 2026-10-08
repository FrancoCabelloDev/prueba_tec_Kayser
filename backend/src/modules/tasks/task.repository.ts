import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

export const taskRepository = {
  list() {
    return prisma.task.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  },
  create(data: Prisma.TaskCreateInput) {
    return prisma.task.create({ data });
  },
  async update(id: number, data: Prisma.TaskUpdateInput) {
    try {
      return await prisma.task.update({ where: { id }, data });
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
