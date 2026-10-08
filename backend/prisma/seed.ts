import { TaskStatus } from '../src/generated/prisma/enums.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const inserted = await prisma.$transaction(async (transaction) => {
    if ((await transaction.task.count()) > 0) return 0;

    const members = await transaction.teamMember.findMany({
      where: { code: { in: ['TI-001', 'TI-002'] }, isActive: true },
      select: { id: true, code: true },
    });
    const franco = members.find((member) => member.code === 'TI-001');
    const oscar = members.find((member) => member.code === 'TI-002');
    if (!franco || !oscar)
      throw new Error(
        'Carga primero el catálogo con npm run db:seed:members y comprueba que TI-001 y TI-002 estén activos.',
      );

    const result = await transaction.task.createMany({
      data: [
        {
          title: 'Revisar respaldos del servidor',
          description: 'Comprobar que los respaldos diarios finalizaron correctamente.',
          responsibleId: franco.id,
          status: TaskStatus.PENDIENTE,
        },
        {
          title: 'Actualizar equipos del área de soporte',
          description: 'Instalar las actualizaciones aprobadas en los equipos del área.',
          responsibleId: oscar.id,
          status: TaskStatus.EN_PROCESO,
        },
        {
          title: 'Documentar la configuración de la red',
          description: 'Registrar las direcciones y los equipos de la red interna.',
          responsibleId: franco.id,
          status: TaskStatus.COMPLETADO,
        },
      ],
    });
    return result.count;
  });

  console.info(
    inserted > 0
      ? `Se crearon ${inserted} tareas de ejemplo.`
      : 'La base ya contiene tareas. No se modificaron los datos existentes.',
  );
}

try {
  await main();
} catch (error) {
  console.error('No se pudieron crear las tareas de ejemplo.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
