import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

try {
  await prisma.$connect();
  // Fail at startup if the database has not been migrated yet.
  await prisma.task.count();
} catch (error) {
  console.error(
    'No se pudo abrir la base de datos. Revisa DATABASE_URL y ejecuta npm run db:migrate.',
    error,
  );
  await prisma.$disconnect();
  process.exit(1);
}

const server = app.listen(env.PORT, '127.0.0.1', () => {
  console.info(`API disponible en http://127.0.0.1:${env.PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `El puerto ${env.PORT} está ocupado. Cambia PORT en backend/.env o libera el puerto.`
      : `No se pudo iniciar la API: ${error.message}`,
  );
  process.exitCode = 1;
  void prisma.$disconnect();
});

function shutdown() {
  server.close(async (error) => {
    if (error) {
      console.error(`No se pudo cerrar la API correctamente: ${error.message}`);
      process.exitCode = 1;
    }
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('No se pudo cerrar la conexión a la base de datos.', disconnectError);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
