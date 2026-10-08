import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './config/openapi.js';
import { errorHandler } from './middlewares/error-handler.js';
import { routeNotFound } from './middlewares/route-not-found.js';
import { taskRouter } from './modules/tasks/task.routes.js';
import { teamMemberRouter } from './modules/team-members/team-member.routes.js';

export function createApp(frontendOrigin: string) {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin === frontendOrigin),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type'],
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api/tasks', taskRouter);
  app.use('/api/team-members', teamMemberRouter);
  app.get('/api/openapi.json', (_request, response) => {
    response.status(200).json(openApiDocument);
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: 'Documentación de la API de tareas',
      swaggerOptions: {
        url: '/api/openapi.json',
        validatorUrl: null,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete'],
      },
    }),
  );
  app.use(routeNotFound);
  app.use(errorHandler);

  return app;
}
