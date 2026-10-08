import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

export const taskRepository = {
  list() {
    return prisma.task.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  },
  create(data: Prisma.TaskCreateInput) {
    return prisma.task.create({ data });
  },
};
