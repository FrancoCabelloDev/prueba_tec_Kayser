import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { Prisma } from '../src/generated/prisma/client.js';
import type { taskRepository as TaskRepository } from '../src/modules/tasks/task.repository.js';
import { openApiDocument } from '../src/config/openapi.js';
import { expectDocumentedResponse } from './helpers/openapi.js';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const testRoot = join(backendDirectory, '.test-data');
const originalDatabaseUrl = process.env.DATABASE_URL;
const frontendOrigin = 'http://127.0.0.1:5173';
const validTask = { title: 'Revisar servidor', responsibleId: 1, status: 'PENDIENTE' as const };

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
  await prisma.teamMember.deleteMany();
  await prisma.teamMember.createMany({
    data: [
      { id: 1, code: 'TI-001', name: 'Ana' },
      { id: 2, code: 'TI-002', name: 'Luis' },
    ],
  });
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
    await expectDocumentedResponse(response, 'get', '/tasks');
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.body).toEqual([]);
    const health = await request(app).get('/api/health').expect(200);
    await expectDocumentedResponse(health, 'get', '/health');
    expect(health.body).toEqual({ status: 'ok' });
  });

  it.each(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO'])(
    'crea y persiste una tarea con el estado %s y devuelve 201',
    async (status) => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ ...validTask, status })
        .expect(201);
      await expectDocumentedResponse(response, 'post', '/tasks');
      expect(response.body).toEqual({
        ...validTask,
        responsible: { id: 1, code: 'TI-001', name: 'Ana', isActive: true },
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
        responsibleId: 1,
        description: '  Primera línea\nSegunda línea  ',
        status: 'PENDIENTE',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      title: 'Revisar servidor',
      responsibleId: 1,
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
        responsibleId: 1,
        description: 'c'.repeat(2000),
        status: 'PENDIENTE',
      })
      .expect(201);
    expect(response.body.title).toHaveLength(150);
    expect(response.body.responsibleId).toBe(1);
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
  ['responsable cero', { ...validTask, responsibleId: 0 }, 'responsibleId'],
  ['responsable negativo', { ...validTask, responsibleId: -1 }, 'responsibleId'],
  ['responsable decimal', { ...validTask, responsibleId: 1.5 }, 'responsibleId'],
  ['responsable numérico como texto', { ...validTask, responsibleId: '1' }, 'responsibleId'],
  ['responsable fuera de rango', { ...validTask, responsibleId: 2147483648 }, 'responsibleId'],
  ['nombre libre del contrato anterior', { ...validTask, responsible: 'Ana' }, 'body'],
  ['título ausente', { responsibleId: 1, status: 'PENDIENTE' }, 'title'],
  ['responsable ausente', { title: 'Tarea', status: 'PENDIENTE' }, 'responsibleId'],
  ['estado ausente', { title: 'Tarea', responsibleId: 1 }, 'status'],
  ['título vacío', { ...validTask, title: '' }, 'title'],
  ['título con espacios', { ...validTask, title: ' \t\n ' }, 'title'],
  ['responsable vacío', { ...validTask, responsibleId: '' }, 'responsibleId'],
  ['responsable con espacios', { ...validTask, responsibleId: ' \t\n ' }, 'responsibleId'],
  ['título de 151 caracteres', { ...validTask, title: 'a'.repeat(151) }, 'title'],
  [
    'responsable de 101 caracteres',
    { ...validTask, responsibleId: 'a'.repeat(101) },
    'responsibleId',
  ],
  [
    'descripción de 2001 caracteres',
    { ...validTask, description: 'a'.repeat(2001) },
    'description',
  ],
  ['título numérico', { ...validTask, title: 123 }, 'title'],
  ['título nulo', { ...validTask, title: null }, 'title'],
  ['responsable como objeto', { ...validTask, responsibleId: { name: 'Ana' } }, 'responsibleId'],
  ['responsable nulo', { ...validTask, responsibleId: null }, 'responsibleId'],
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
    await expectDocumentedResponse(response, 'post', '/tasks');
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
      responsibleId: ['El responsable es obligatorio.'],
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
    await expectDocumentedResponse(response, 'post', '/tasks');
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
    await expectDocumentedResponse(response, 'post', '/tasks');
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(await prisma.task.count()).toBe(0);
  });

  it('responde en JSON cuando el charset no está soportado', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send(JSON.stringify(validTask))
      .expect(415);
    await expectDocumentedResponse(response, 'post', '/tasks');
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
      await expectDocumentedResponse(response, operation === 'list' ? 'get' : 'post', '/tasks');
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

const validUpdate = {
  title: 'Actualizar servidor',
  description: 'Actualizar los servicios del equipo.',
  responsibleId: 2,
  status: 'EN_PROCESO',
};

async function existingTask() {
  return prisma.task.create({
    data: {
      title: validTask.title,
      description: 'Descripción original',
      responsibleId: validTask.responsibleId,
      status: 'COMPLETADO',
      updatedAt: new Date('2000-01-01T00:00:00Z'),
    },
  });
}

describe('Edición de tareas por HTTP', () => {
  it.each(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO'])(
    'edita todos los campos y permite cambiar al estado %s',
    async (status) => {
      const original = await existingTask();
      const response = await request(app)
        .put(`/api/tasks/${original.id}`)
        .send({ ...validUpdate, status })
        .expect(200);
      await expectDocumentedResponse(response, 'put', '/tasks/{id}');

      expect(response.body).toEqual({
        ...validUpdate,
        responsible: { id: 2, code: 'TI-002', name: 'Luis', isActive: true },
        status,
        id: original.id,
        createdAt: original.createdAt.toISOString(),
        updatedAt: expect.any(String),
      });
      expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(original.updatedAt.getTime());
      const persisted = await prisma.task.findUniqueOrThrow({ where: { id: original.id } });
      expect(persisted).toMatchObject({ ...validUpdate, status });
      expect(persisted.createdAt).toEqual(original.createdAt);
      expect(persisted.updatedAt.toISOString()).toBe(response.body.updatedAt);
      const list = await request(app).get('/api/tasks').expect(200);
      expect(list.body).toEqual([response.body]);
    },
  );

  it('recorta espacios en los campos de edición', async () => {
    const original = await existingTask();
    const response = await request(app)
      .put(`/api/tasks/${original.id}`)
      .send({
        title: '  Título editado  ',
        description: '  Detalle\nSegunda línea  ',
        responsibleId: 2,
        status: 'EN_PROCESO',
      })
      .expect(200);
    expect(response.body).toMatchObject({
      title: 'Título editado',
      description: 'Detalle\nSegunda línea',
      responsibleId: 2,
    });
  });

  it.each([null, '', '   '])('permite borrar la descripción enviando %s', async (description) => {
    const original = await existingTask();
    const response = await request(app)
      .put(`/api/tasks/${original.id}`)
      .send({ ...validUpdate, description })
      .expect(200);
    await expectDocumentedResponse(response, 'put', '/tasks/{id}');
    expect(response.body.description).toBeNull();
    expect(
      (await prisma.task.findUniqueOrThrow({ where: { id: original.id } })).description,
    ).toBeNull();
  });

  it('acepta los límites de longitud y mantiene las demás tareas sin cambios', async () => {
    const original = await existingTask();
    const unrelated = await existingTask();
    const update = {
      title: 'a'.repeat(150),
      responsibleId: 1,
      description: 'c'.repeat(2000),
      status: 'COMPLETADO',
    };
    const response = await request(app).put(`/api/tasks/${original.id}`).send(update).expect(200);
    expect(response.body).toMatchObject(update);
    expect(await prisma.task.findUnique({ where: { id: unrelated.id } })).toEqual(unrelated);
    expect(await prisma.task.count()).toBe(2);
  });

  it.each(invalidTasks)(
    'rechaza %s al editar y conserva la tarea original',
    async (_name, body, field) => {
      const original = await existingTask();
      const updateBody =
        typeof body === 'object' && body !== null && !Array.isArray(body)
          ? { description: 'Descripción enviada', ...body }
          : body;
      const response = await request(app)
        .put(`/api/tasks/${original.id}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(updateBody))
        .expect(400);
      await expectDocumentedResponse(response, 'put', '/tasks/{id}');
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { [field]: expect.arrayContaining([expect.any(String)]) },
      });
      expect(await prisma.task.findUnique({ where: { id: original.id } })).toEqual(original);
    },
  );

  it('exige los cuatro campos editables en PUT y rechaza actualizaciones parciales', async () => {
    const original = await existingTask();
    const response = await request(app).put(`/api/tasks/${original.id}`).send({}).expect(400);
    expect(Object.keys(response.body.error.fields).sort()).toEqual([
      'description',
      'responsibleId',
      'status',
      'title',
    ]);
    const missingDescription = await request(app)
      .put(`/api/tasks/${original.id}`)
      .send(validTask)
      .expect(400);
    expect(missingDescription.body.error.fields).toEqual({
      description: ['Envía la descripción como texto o null al editar la tarea.'],
    });
    expect(await prisma.task.findUnique({ where: { id: original.id } })).toEqual(original);
  });

  it.each(['id', 'createdAt', 'updatedAt'])(
    'impide modificar el campo protegido %s',
    async (field) => {
      const original = await existingTask();
      const response = await request(app)
        .put(`/api/tasks/${original.id}`)
        .send({
          ...validUpdate,
          [field]: field === 'id' ? original.id + 100 : '2000-01-01T00:00:00Z',
        })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.fields.body).toEqual([expect.any(String)]);
      expect(await prisma.task.findUnique({ where: { id: original.id } })).toEqual(original);
    },
  );

  it('rechaza una edición sin cuerpo', async () => {
    const original = await existingTask();
    const response = await request(app).put(`/api/tasks/${original.id}`).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.task.findUnique({ where: { id: original.id } })).toEqual(original);
  });

  it('rechaza JSON mal formado al editar sin modificar la tarea', async () => {
    const original = await existingTask();
    const response = await request(app)
      .put(`/api/tasks/${original.id}`)
      .set('Content-Type', 'application/json')
      .send('{"title":')
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(await prisma.task.findUnique({ where: { id: original.id } })).toEqual(original);
  });
});

describe('Eliminación de tareas por HTTP', () => {
  it('elimina únicamente la tarea indicada y devuelve 204 sin cuerpo', async () => {
    const removed = await existingTask();
    const remaining = await existingTask();
    const response = await request(app).delete(`/api/tasks/${removed.id}`).expect(204);
    await expectDocumentedResponse(response, 'delete', '/tasks/{id}');
    expect(response.text).toBe('');
    expect(response.headers['content-type']).toBeUndefined();
    expect(await prisma.task.findUnique({ where: { id: removed.id } })).toBeNull();
    expect(await prisma.task.findUnique({ where: { id: remaining.id } })).toEqual(remaining);
    const list = await request(app).get('/api/tasks').expect(200);
    expect(list.body).toMatchObject([{ id: remaining.id }]);
    expect(list.body).toHaveLength(1);
  });

  it('devuelve 404 al volver a eliminar o editar una tarea eliminada', async () => {
    const original = await existingTask();
    await request(app).delete(`/api/tasks/${original.id}`).expect(204);
    const deletion = await request(app).delete(`/api/tasks/${original.id}`).expect(404);
    const update = await request(app)
      .put(`/api/tasks/${original.id}`)
      .send(validUpdate)
      .expect(404);
    for (const response of [deletion, update]) {
      expect(response.body).toEqual({
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'La tarea solicitada no existe.',
        },
      });
    }
    expect(await prisma.task.count()).toBe(0);
  });

  it('completa el flujo crear, editar, consultar y eliminar', async () => {
    const created = await request(app).post('/api/tasks').send(validTask).expect(201);
    const updated = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .send(validUpdate)
      .expect(200);
    const list = await request(app).get('/api/tasks').expect(200);
    expect(list.body).toEqual([updated.body]);
    await request(app).delete(`/api/tasks/${created.body.id}`).expect(204);
    const empty = await request(app).get('/api/tasks').expect(200);
    expect(empty.body).toEqual([]);
    expect(await prisma.task.count()).toBe(0);
  });
});

const invalidTaskIds = [
  '0',
  '-1',
  '1.5',
  'abc',
  '1abc',
  '1e3',
  '0x10',
  '+1',
  '01',
  '2147483648',
  '9007199254740992',
  '9'.repeat(100),
  '%20',
  '%201%20',
  '1%2F2',
  '1%0A',
  '1%0D',
  '1%0D%0A',
];

describe('Asignación a integrantes registrados', () => {
  it.each(['post', 'put'] as const)(
    'rechaza en %s una nueva asignación desactivada después de consultar el catálogo',
    async (method) => {
      const original = await existingTask();
      const catalog = await request(app).get('/api/team-members').expect(200);
      expect(catalog.body).toContainEqual({ id: 2, code: 'TI-002', name: 'Luis', isActive: true });
      await prisma.teamMember.update({ where: { id: 2 }, data: { isActive: false } });
      const response = await request(app)
        [method](method === 'post' ? '/api/tasks' : `/api/tasks/${original.id}`)
        .send(validUpdate)
        .expect(400);
      await expectDocumentedResponse(
        response,
        method,
        method === 'post' ? '/tasks' : '/tasks/{id}',
      );
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { responsibleId: ['Selecciona un integrante activo del equipo.'] },
      });
      expect(await prisma.task.findMany()).toEqual([original]);
    },
  );

  it('no permite trasladar el responsable inactivo de otra tarea a una nueva asignación', async () => {
    const historical = await existingTask();
    const other = await prisma.task.create({ data: { ...validTask, responsibleId: 2 } });
    await prisma.teamMember.update({ where: { id: 1 }, data: { isActive: false } });
    const response = await request(app)
      .put(`/api/tasks/${other.id}`)
      .send({ ...validUpdate, responsibleId: 1 })
      .expect(400);
    await expectDocumentedResponse(response, 'put', '/tasks/{id}');
    expect(response.body.error.fields.responsibleId).toEqual([
      'Selecciona un integrante activo del equipo.',
    ]);
    expect(await prisma.task.findUnique({ where: { id: other.id } })).toEqual(other);
    expect(await prisma.task.findUnique({ where: { id: historical.id } })).toEqual(historical);
  });

  it('asigna y reasigna homónimos por identificador sin mezclar sus tareas', async () => {
    await prisma.teamMember.update({ where: { id: 2 }, data: { name: 'Ana' } });
    const first = await request(app).post('/api/tasks').send(validTask).expect(201);
    const second = await request(app)
      .post('/api/tasks')
      .send({ ...validTask, responsibleId: 2 })
      .expect(201);
    expect(first.body.responsible).toEqual({ id: 1, code: 'TI-001', name: 'Ana', isActive: true });
    expect(second.body.responsible).toEqual({ id: 2, code: 'TI-002', name: 'Ana', isActive: true });
    const untouched = await prisma.task.findUniqueOrThrow({ where: { id: second.body.id } });
    const reassigned = await request(app)
      .put(`/api/tasks/${first.body.id}`)
      .send(validUpdate)
      .expect(200);
    await expectDocumentedResponse(reassigned, 'put', '/tasks/{id}');
    expect(reassigned.body).toMatchObject({
      responsibleId: 2,
      responsible: second.body.responsible,
    });
    expect(await prisma.task.findUnique({ where: { id: second.body.id } })).toEqual(untouched);
  });

  it('elimina solo la tarea elegida y conserva al integrante y otra tarea del mismo responsable', async () => {
    const removed = await existingTask();
    const remaining = await prisma.task.create({
      data: { ...validTask, title: 'Conservar tarea' },
    });
    const membersBefore = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } });
    await request(app).delete(`/api/tasks/${removed.id}`).expect(204);
    expect(await prisma.task.findMany()).toEqual([remaining]);
    expect(await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })).toEqual(membersBefore);
    const listed = await request(app).get('/api/tasks').expect(200);
    await expectDocumentedResponse(listed, 'get', '/tasks');
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ id: remaining.id, responsibleId: 1 });
  });

  it.each(['post', 'put'] as const)(
    'traduce un fallo de referencia en %s a un error del selector sin exponer Prisma',
    async (method) => {
      const original = await existingTask();
      vi.spyOn(repository, method === 'post' ? 'create' : 'update').mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Detalle privado de la clave foránea', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );
      const response = await request(app)
        [method](method === 'post' ? '/api/tasks' : `/api/tasks/${original.id}`)
        .send(validUpdate)
        .expect(400);
      await expectDocumentedResponse(
        response,
        method,
        method === 'post' ? '/tasks' : '/tasks/{id}',
      );
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { responsibleId: ['El responsable seleccionado ya no está disponible.'] },
      });
      expect(response.text).not.toContain('Detalle privado');
      expect(response.text).not.toContain('P2003');
      expect(await prisma.task.findMany()).toEqual([original]);
    },
  );
  it.each(['post', 'put'] as const)(
    'rechaza un responsable inexistente o inactivo en %s sin cambiar tareas',
    async (method) => {
      const task = await existingTask();
      await prisma.teamMember.update({ where: { id: 2 }, data: { isActive: false } });
      for (const responsibleId of [2, 2147483647]) {
        const response = await request(app)
          [method](method === 'post' ? '/api/tasks' : `/api/tasks/${task.id}`)
          .send({ ...validUpdate, responsibleId })
          .expect(400);
        await expectDocumentedResponse(
          response,
          method,
          method === 'post' ? '/tasks' : '/tasks/{id}',
        );
        expect(response.body.error.fields.responsibleId).toEqual([expect.any(String)]);
        expect(await prisma.task.findMany()).toEqual([task]);
      }
    },
  );
  it('permite conservar al responsable inactivo actual y reasignar después a uno activo', async () => {
    const task = await existingTask();
    await prisma.teamMember.update({ where: { id: 1 }, data: { isActive: false } });
    const kept = await request(app)
      .put(`/api/tasks/${task.id}`)
      .send({ ...validUpdate, responsibleId: 1 })
      .expect(200);
    await expectDocumentedResponse(kept, 'put', '/tasks/{id}');
    expect(kept.body.responsible).toEqual({ id: 1, code: 'TI-001', name: 'Ana', isActive: false });
    expect(
      (await request(app).get('/api/team-members')).body.map((member: { id: number }) => member.id),
    ).toEqual([2]);
    const reassigned = await request(app)
      .put(`/api/tasks/${task.id}`)
      .send(validUpdate)
      .expect(200);
    expect(reassigned.body.responsibleId).toBe(2);
    expect(reassigned.body.responsible.isActive).toBe(true);
  });
  it('protege al integrante referenciado y conserva el catálogo al eliminar la tarea', async () => {
    const task = await existingTask();
    await expect(prisma.teamMember.delete({ where: { id: 1 } })).rejects.toThrow();
    await request(app).delete(`/api/tasks/${task.id}`).expect(204);
    expect(await prisma.teamMember.count()).toBe(2);
  });
  it('responde 404 para una tarea inexistente antes de validar la existencia del integrante', async () => {
    const response = await request(app)
      .put('/api/tasks/2147483647')
      .send({ ...validUpdate, responsibleId: 2147483647 })
      .expect(404);
    await expectDocumentedResponse(response, 'put', '/tasks/{id}');
    expect(response.body.error.code).toBe('TASK_NOT_FOUND');
  });
});

describe.each(['put', 'delete'] as const)('Identificadores y errores en %s', (method) => {
  it.each(invalidTaskIds)(
    'rechaza el identificador %s con 400 antes de consultar la base',
    async (id) => {
      const original = await existingTask();
      const operation = method === 'put' ? 'update' : 'delete';
      const databaseCall = vi.spyOn(repository, operation);
      const response = await request(app)[method](`/api/tasks/${id}`).send(validUpdate).expect(400);
      await expectDocumentedResponse(response, method, '/tasks/{id}');
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { id: [expect.any(String)] },
      });
      expect(databaseCall).not.toHaveBeenCalled();
      expect(await prisma.task.findUnique({ where: { id: original.id } })).toEqual(original);
    },
  );

  it('rechaza una codificación de URL inválida con un error JSON de 400', async () => {
    const response = await request(app)[method]('/api/tasks/%ZZ').send(validUpdate).expect(400);
    await expectDocumentedResponse(response, method, '/tasks/{id}');
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'La ruta contiene una codificación inválida.',
      },
    });
  });

  it('devuelve 404 para un identificador válido inexistente sin afectar otras tareas', async () => {
    const original = await existingTask();
    const response = await request(app)
      [method]('/api/tasks/2147483647')
      .send(validUpdate)
      .expect(404);
    await expectDocumentedResponse(response, method, '/tasks/{id}');
    expect(response.body).toEqual({
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'La tarea solicitada no existe.',
      },
    });
    expect(await prisma.task.findUnique({ where: { id: original.id } })).toEqual(original);
    expect(await prisma.task.count()).toBe(1);
  });

  it('responde con 500 ante un fallo inesperado sin exponerlo ni modificar la tarea', async () => {
    const original = await existingTask();
    const operation = method === 'put' ? 'update' : 'delete';
    const failure = new Error('Error interno de SQLite que no debe llegar al cliente');
    vi.spyOn(repository, operation).mockRejectedValueOnce(failure);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(app)
      [method](`/api/tasks/${original.id}`)
      .send(validUpdate)
      .expect(500);
    await expectDocumentedResponse(response, method, '/tasks/{id}');
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'No se pudo procesar la solicitud.',
      },
    });
    expect(response.text).not.toContain(failure.message);
    expect(log).toHaveBeenCalledWith('Error inesperado al procesar la solicitud.', failure);
    expect(await prisma.task.findUnique({ where: { id: original.id } })).toEqual(original);
  });
});

describe('Documentación servida por la API', () => {
  it('publica como JSON el mismo contrato del archivo OpenAPI', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual(openApiDocument);
  });

  it('redirige a la URL con barra final y carga la página de Swagger UI', async () => {
    const redirect = await request(app).get('/api/docs').expect(301);
    expect(redirect.headers.location).toBe('/api/docs/');
    const page = await request(app).get('/api/docs/').expect(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.text).toContain('Documentación de la API de tareas');
    expect(page.text).toContain('swagger-ui-init.js');
  });

  it.each(['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js'])(
    'sirve el recurso local %s de Swagger',
    async (asset) => {
      const response = await request(app).get(`/api/docs/${asset}`).expect(200);
      expect(response.headers['content-type']).toMatch(
        asset.endsWith('.css') ? /text\/css/ : /javascript/,
      );
      expect(response.text.length).toBeGreaterThan(0);
    },
  );

  it('configura Swagger para cargar el contrato local y ejecutar las cuatro operaciones', async () => {
    const response = await request(app).get('/api/docs/swagger-ui-init.js').expect(200);
    expect(response.headers['content-type']).toMatch(/javascript/);
    expect(response.text).toContain('"url": "/api/openapi.json"');
    expect(response.text).toContain('"validatorUrl": null');
    for (const method of ['get', 'post', 'put', 'delete']) {
      expect(response.text).toContain(`"${method}"`);
    }
  });
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

  it.each(['PUT', 'DELETE'])('permite la preflight para %s', async (method) => {
    const response = await request(app)
      .options('/api/tasks/1')
      .set('Origin', frontendOrigin)
      .set('Access-Control-Request-Method', method)
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(frontendOrigin);
    expect(response.headers['access-control-allow-methods']).toContain(method);
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type');
    expect(await prisma.task.count()).toBe(0);
  });

  it('permite clientes sin Origin, como Postman y scripts', async () => {
    const response = await request(app).post('/api/tasks').send(validTask).expect(201);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
