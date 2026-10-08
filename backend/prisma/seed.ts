import { TaskStatus } from '../src/generated/prisma/enums.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const inserted = await prisma.$transaction(async (transaction) => {
    if ((await transaction.task.count()) > 0) return 0;

    const result = await transaction.task.createMany({
      data: [
        {
          title: 'Revisar respaldos del servidor',
          description: 'Comprobar que los respaldos diarios finalizaron correctamente.',
          responsible: 'Ana Torres',
          status: TaskStatus.PENDIENTE,
        },
        {
          title: 'Actualizar equipos del área de soporte',
          description: 'Instalar las actualizaciones aprobadas en los equipos del área.',
          responsible: 'Luis Ramírez',
          status: TaskStatus.EN_PROCESO,
        },
        {
          title: 'Documentar la configuración de la red',
          description: 'Registrar las direcciones y los equipos de la red interna.',
          responsible: 'María López',
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
