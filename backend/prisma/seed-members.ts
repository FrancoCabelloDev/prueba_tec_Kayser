import { prisma } from '../src/lib/prisma.js';
import { initialTeamMembers } from './team-members.data.js';
import { seedTeamMembers } from './team-members.seed.js';

try {
  const inserted = await seedTeamMembers(prisma, initialTeamMembers);
  console.info(
    inserted > 0
      ? `Se registraron ${inserted} integrantes del equipo. Los existentes se conservaron.`
      : 'Los integrantes del catálogo ya están registrados. No se modificaron sus datos.',
  );
} catch (error) {
  console.error('No se pudo cargar el catálogo de integrantes.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
