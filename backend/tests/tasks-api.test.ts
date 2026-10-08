import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { taskRepository as TaskRepository } from '../src/modules/tasks/task.repository.js';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const testRoot = join(backendDirectory, '.test-data');
const originalDatabaseUrl = process.env.DATABASE_URL;
const frontendOrigin = 'http://127.0.0.1:5173';
const validTask = { title: 'Revisar servidor', responsible: 'Ana', status: 'PENDIENTE' };

let temporaryDirectory: string;
let prisma: PrismaClient;
let app: Express;
let repository: typeof TaskRepository;

beforeAll(async () => {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Ejecuta las pruebas mediante npm run test:api o npm test.');

  mkdirSync(testRoot, { recursive: true });
  temporaryDirectory = mkdtempSync(join(testRoot, 'api-'));
  process.env.DATABASE_URL = `file:${join(temporaryDirectory, 'test.db').replaceAll('\\', '/')}`;

  execFileSync(process.execPath, [npmCli, 'run', 'db:migrate'], {
    cwd: backendDirectory,
    env: process.env,
    encoding: 'utf8',
    timeout: 45000,
    stdio: 'pipe',
  });

  prisma = (await import('../src/lib/prisma.js')).prisma;
  repository = (await import('../src/modules/tasks/task.repository.js')).taskRepository;
  app = (await import('../src/app.js')).createApp(frontendOrigin);
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.task.deleteMany();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;

  if (temporaryDirectory) {
    const withinRoot = relative(testRoot, temporaryDirectory);
    if (!withinRoot || withinRoot.startsWith('..') || isAbsolute(withinRoot)) {
      throw new Error('Se rechazó la limpieza de una ruta ajena a las pruebas.');
    }
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

describe('Listado y creación de tareas por HTTP', () => {
  it('devuelve una lista vacía con 200 y conserva el endpoint de salud', async () => {
    const response = await request(app).get('/api/tasks').expect(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.body).toEqual([]);
    const health = await request(app).get('/api/health').expect(200);
    expect(health.body).toEqual({ status: 'ok' });
  });

  it.each(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO'])(
    'crea y persiste una tarea con el estado %s y devuelve 201',
    async (status) => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ ...validTask, status })
        .expect(201);
      expect(response.body).toEqual({
        ...validTask,
        status,
        description: null,
        id: expect.any(Number),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(response.body.id).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(response.body.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(response.body.updatedAt))).toBe(false);
      expect(await prisma.task.findUnique({ where: { id: response.body.id } })).toMatchObject({
        ...validTask,
        status,
        description: null,
      });
      const list = await request(app).get('/api/tasks').expect(200);
      expect(list.body).toEqual([response.body]);
    },
  );

  it('recorta espacios al inicio y al final conservando el contenido interno', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({
        title: '  Revisar servidor  ',
        responsible: '  Ana Pérez  ',
        description: '  Primera línea\nSegunda línea  ',
        status: 'PENDIENTE',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      title: 'Revisar servidor',
      responsible: 'Ana Pérez',
      description: 'Primera línea\nSegunda línea',
    });
  });

  it.each([undefined, null, '', '   '])(
    'guarda como null una descripción vacía (%s)',
    async (description) => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ ...validTask, description })
        .expect(201);
      expect(response.body.description).toBeNull();
      expect(
        (await prisma.task.findUniqueOrThrow({ where: { id: response.body.id } })).description,
      ).toBeNull();
    },
  );

  it('acepta las longitudes máximas permitidas', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({
        title: 'a'.repeat(150),
        responsible: 'b'.repeat(100),
        description: 'c'.repeat(2000),
        status: 'PENDIENTE',
      })
      .expect(201);
    expect(response.body.title).toHaveLength(150);
    expect(response.body.responsible).toHaveLength(100);
    expect(response.body.description).toHaveLength(2000);
  });

  it('permite crear dos tareas con el mismo título', async () => {
    const first = await request(app).post('/api/tasks').send(validTask).expect(201);
    const second = await request(app).post('/api/tasks').send(validTask).expect(201);
    expect(first.body.id).not.toBe(second.body.id);
    expect(await prisma.task.count()).toBe(2);
  });

  it('ordena primero por creación reciente y desempata por identificador descendente', async () => {
    const older = await prisma.task.create({
      data: {
        ...validTask,
        status: 'PENDIENTE',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const newer = await prisma.task.create({
      data: {
        ...validTask,
        status: 'EN_PROCESO',
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    });
    const sameDate = await prisma.task.create({
      data: {
        ...validTask,
        status: 'COMPLETADO',
        createdAt: newer.createdAt,
      },
    });
    const response = await request(app).get('/api/tasks').expect(200);
    expect(response.body).toMatchObject([{ id: sameDate.id }, { id: newer.id }, { id: older.id }]);
  });
});

const invalidTasks: Array<[string, unknown, string]> = [
  ['título ausente', { responsible: 'Ana', status: 'PENDIENTE' }, 'title'],
  ['responsable ausente', { title: 'Tarea', status: 'PENDIENTE' }, 'responsible'],
  ['estado ausente', { title: 'Tarea', responsible: 'Ana' }, 'status'],
  ['título vacío', { ...validTask, title: '' }, 'title'],
  ['título con espacios', { ...validTask, title: ' \t\n ' }, 'title'],
  ['responsable vacío', { ...validTask, responsible: '' }, 'responsible'],
  ['responsable con espacios', { ...validTask, responsible: ' \t\n ' }, 'responsible'],
  ['título de 151 caracteres', { ...validTask, title: 'a'.repeat(151) }, 'title'],
  ['responsable de 101 caracteres', { ...validTask, responsible: 'a'.repeat(101) }, 'responsible'],
  [
    'descripción de 2001 caracteres',
    { ...validTask, description: 'a'.repeat(2001) },
    'description',
  ],
  ['título numérico', { ...validTask, title: 123 }, 'title'],
  ['título nulo', { ...validTask, title: null }, 'title'],
  ['responsable como objeto', { ...validTask, responsible: { name: 'Ana' } }, 'responsible'],
  ['responsable nulo', { ...validTask, responsible: null }, 'responsible'],
  ['descripción numérica', { ...validTask, description: 123 }, 'description'],
  ['descripción como arreglo', { ...validTask, description: [] }, 'description'],
  ['estado desconocido', { ...validTask, status: 'BLOQUEADO' }, 'status'],
  ['estado para visualización', { ...validTask, status: 'Pendiente' }, 'status'],
  ['estado en minúsculas', { ...validTask, status: 'pendiente' }, 'status'],
  ['estado nulo', { ...validTask, status: null }, 'status'],
  ['estado numérico', { ...validTask, status: 1 }, 'status'],
  ['identificador enviado por el cliente', { ...validTask, id: 500 }, 'body'],
  ['fecha enviada por el cliente', { ...validTask, createdAt: '2026-01-01' }, 'body'],
  ['campo adicional', { ...validTask, extra: 'valor' }, 'body'],
  ['objeto vacío', {}, 'title'],
  ['arreglo de tareas', [validTask], 'body'],
];

describe('Validaciones y errores de la API', () => {
  it.each(invalidTasks)('rechaza %s con 400 sin guardar datos', async (_name, body, field) => {
    const response = await request(app)
      .post('/api/tasks')
      .send(JSON.stringify(body))
      .set('Content-Type', 'application/json')
      .expect(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Revisa los campos enviados.',
      fields: { [field]: expect.arrayContaining([expect.any(String)]) },
    });
    expect(await prisma.task.count()).toBe(0);
  });

  it('devuelve errores de todos los campos obligatorios en una sola respuesta', async () => {
    const response = await request(app).post('/api/tasks').send({}).expect(400);
    expect(response.body.error.fields).toEqual({
      title: ['El título es obligatorio.'],
      responsible: ['El responsable es obligatorio.'],
      status: ['El estado es obligatorio.'],
    });
  });

  it('rechaza una solicitud sin cuerpo', async () => {
    const response = await request(app).post('/api/tasks').expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.task.count()).toBe(0);
  });

  it('devuelve JSON consistente cuando el cuerpo contiene JSON mal formado', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title":')
      .expect(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: 'El cuerpo de la solicitud debe ser JSON válido.',
      },
    });
    expect(await prisma.task.count()).toBe(0);
  });

  it('rechaza cuerpos que superan 16 KB antes de acceder a la base', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ ...validTask, description: 'a'.repeat(17 * 1024) })
      .expect(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(await prisma.task.count()).toBe(0);
  });

  it('responde en JSON cuando el charset no está soportado', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send(JSON.stringify(validTask))
      .expect(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_ENCODING');
    expect(await prisma.task.count()).toBe(0);
  });

  it('devuelve 404 en JSON para una ruta inexistente', async () => {
    const response = await request(app).get('/api/desconocida').expect(404);
    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'La ruta solicitada no existe.',
      },
    });
  });

  it.each(['list', 'create'] as const)(
    'centraliza un fallo inesperado al ejecutar %s sin exponer detalles internos',
    async (operation) => {
      const failure = new Error('Detalle interno de SQLite que no debe llegar al cliente');
      vi.spyOn(repository, operation).mockRejectedValueOnce(failure);
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const response =
        operation === 'list'
          ? await request(app).get('/api/tasks').expect(500)
          : await request(app).post('/api/tasks').send(validTask).expect(500);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'No se pudo procesar la solicitud.',
        },
      });
      expect(response.text).not.toContain(failure.message);
      expect(log).toHaveBeenCalledWith('Error inesperado al procesar la solicitud.', failure);
      expect(await prisma.task.count()).toBe(0);
    },
  );
});

describe('CORS para el frontend configurado', () => {
  it('incluye el origen permitido en las respuestas', async () => {
    const response = await request(app).get('/api/tasks').set('Origin', frontendOrigin).expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(frontendOrigin);
    expect(response.headers.vary).toContain('Origin');
  });

  it('responde a la preflight del navegador para crear tareas', async () => {
    const response = await request(app)
      .options('/api/tasks')
      .set('Origin', frontendOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(frontendOrigin);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type');
    expect(await prisma.task.count()).toBe(0);
  });

  it('omite el permiso CORS para un origen diferente', async () => {
    const response = await request(app)
      .get('/api/tasks')
      .set('Origin', 'http://otro-origen.test')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('permite clientes sin Origin, como Postman y scripts', async () => {
    const response = await request(app).post('/api/tasks').send(validTask).expect(201);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
