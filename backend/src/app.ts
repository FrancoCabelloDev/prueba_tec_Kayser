import cors from 'cors';
import express from 'express';
import { errorHandler } from './middlewares/error-handler.js';
import { routeNotFound } from './middlewares/route-not-found.js';
import { taskRouter } from './modules/tasks/task.routes.js';

export function createApp(frontendOrigin: string) {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin === frontendOrigin),
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api/tasks', taskRouter);
  app.use(routeNotFound);
  app.use(errorHandler);

  return app;
}
