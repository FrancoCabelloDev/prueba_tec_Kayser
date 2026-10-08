import { app } from './app.js';
import { env } from './config/env.js';

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
});

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error(`No se pudo cerrar la API correctamente: ${error.message}`);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
