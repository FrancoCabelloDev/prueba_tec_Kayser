import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialTeamMembers } from '../prisma/team-members.data.js';
import { seedTeamMembers } from '../prisma/team-members.seed.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { teamMemberRepository as TeamMemberRepository } from '../src/modules/team-members/team-member.repository.js';
import { expectDocumentedResponse } from './helpers/openapi.js';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const testRoot = join(backendDirectory, '.test-data');
const originalDatabaseUrl = process.env.DATABASE_URL;
const frontendOrigin = 'http://127.0.0.1:5173';
let temporaryDirectory: string;
let prisma: PrismaClient;
let app: Express;
let repository: typeof TeamMemberRepository;

beforeAll(async () => {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Ejecuta las pruebas mediante npm run test:members:api o npm test.');
  mkdirSync(testRoot, { recursive: true });
  temporaryDirectory = mkdtempSync(join(testRoot, 'members-api-'));
  process.env.DATABASE_URL = `file:${join(temporaryDirectory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [npmCli, 'run', 'db:migrate'], {
    cwd: backendDirectory,
    env: process.env,
    encoding: 'utf8',
    timeout: 45000,
    windowsHide: true,
    stdio: 'pipe',
  });
  prisma = (await import('../src/lib/prisma.js')).prisma;
  repository = (await import('../src/modules/team-members/team-member.repository.js'))
    .teamMemberRepository;
  app = (await import('../src/app.js')).createApp(frontendOrigin);
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.teamMember.deleteMany();
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

describe('Consulta de integrantes activos por HTTP', () => {
  it('devuelve 200 y [] con un catálogo vacío, sin autenticación ni carga automática', async () => {
    const response = await request(app).get('/api/team-members').expect(200);
    await expectDocumentedResponse(response, 'get', '/team-members');
    expect(response.body).toEqual([]);
    expect(await prisma.teamMember.count()).toBe(0);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('consulta el catálogo confirmado y publica exclusivamente los cuatro campos definidos', async () => {
    await seedTeamMembers(prisma, initialTeamMembers);
    const members = await prisma.teamMember.findMany({ orderBy: { code: 'asc' } });
    const response = await request(app).get('/api/team-members').expect(200);
    await expectDocumentedResponse(response, 'get', '/team-members');
    expect(response.body).toEqual(
      members.map(({ id, code, name, isActive }) => ({ id, code, name, isActive })),
    );
    expect(response.body).toMatchObject([
      { code: 'TI-001', name: 'Franco Cabello', isActive: true },
      { code: 'TI-002', name: 'Oscar Perez', isActive: true },
    ]);
  });

  it('devuelve [] cuando todos los integrantes están inactivos y conserva sus filas', async () => {
    await prisma.teamMember.createMany({
      data: [
        { code: 'TI-100', name: 'Ana', isActive: false },
        { code: 'TI-101', name: 'Luis', isActive: false },
      ],
    });
    const response = await request(app).get('/api/team-members').expect(200);
    await expectDocumentedResponse(response, 'get', '/team-members');
    expect(response.body).toEqual([]);
    expect(await prisma.teamMember.count()).toBe(2);
  });

  it('excluye integrantes inactivos cuando el catálogo contiene ambos estados', async () => {
    await prisma.teamMember.createMany({
      data: [
        { code: 'TI-100', name: 'Ana', isActive: false },
        { code: 'TI-101', name: 'Luis' },
      ],
    });
    const response = await request(app).get('/api/team-members').expect(200);
    await expectDocumentedResponse(response, 'get', '/team-members');
    expect(response.body).toEqual([
      { id: expect.any(Number), code: 'TI-101', name: 'Luis', isActive: true },
    ]);
  });

  it('ordena por nombre ascendente y desempata homónimos por código, con identidades distintas', async () => {
    await prisma.teamMember.createMany({
      data: [
        { code: 'TI-001', name: 'Zoe' },
        { code: 'TI-200', name: 'Ana' },
        { code: 'TI-100', name: 'Ana' },
        { code: 'TI-300', name: 'Bruno' },
      ],
    });
    const first = await request(app).get('/api/team-members').expect(200);
    const second = await request(app).get('/api/team-members').expect(200);
    await expectDocumentedResponse(first, 'get', '/team-members');
    expect(first.body).toEqual([
      { id: expect.any(Number), code: 'TI-100', name: 'Ana', isActive: true },
      { id: expect.any(Number), code: 'TI-200', name: 'Ana', isActive: true },
      { id: expect.any(Number), code: 'TI-300', name: 'Bruno', isActive: true },
      { id: expect.any(Number), code: 'TI-001', name: 'Zoe', isActive: true },
    ]);
    expect(second.body).toEqual(first.body);
    expect(first.body[0].id).not.toBe(first.body[1].id);
  });

  it('refleja cambios y bajas guardados en SQLite en la siguiente consulta', async () => {
    await seedTeamMembers(prisma, initialTeamMembers);
    expect((await request(app).get('/api/team-members').expect(200)).body).toHaveLength(2);
    await prisma.teamMember.update({ where: { code: 'TI-001' }, data: { isActive: false } });
    const updated = await prisma.teamMember.update({
      where: { code: 'TI-002' },
      data: { name: 'Oscar Perez actualizado' },
    });
    const response = await request(app).get('/api/team-members').expect(200);
    await expectDocumentedResponse(response, 'get', '/team-members');
    expect(response.body).toEqual([
      { id: updated.id, code: updated.code, name: updated.name, isActive: true },
    ]);
    expect(await prisma.teamMember.count()).toBe(2);
  });

  it('no modifica integrantes, fechas ni tareas al consultar el catálogo', async () => {
    await seedTeamMembers(prisma, initialTeamMembers);
    const task = await prisma.task.create({
      data: { title: 'Tarea existente', responsible: 'Texto libre', status: 'PENDIENTE' },
    });
    const membersBefore = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } });
    await request(app).get('/api/team-members').expect(200);
    expect(await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })).toEqual(membersBefore);
    expect(await prisma.task.findMany()).toEqual([task]);
  });

  it('devuelve un error 500 documentado sin exponer detalles de persistencia', async () => {
    const failure = new Error('Detalle interno de SQLite y Prisma que no debe publicarse');
    vi.spyOn(repository, 'listActive').mockRejectedValueOnce(failure);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(app).get('/api/team-members').expect(500);
    await expectDocumentedResponse(response, 'get', '/team-members');
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'No se pudo procesar la solicitud.' },
    });
    expect(response.text).not.toContain(failure.message);
    expect(log).toHaveBeenCalledWith('Error inesperado al procesar la solicitud.', failure);
  });

  it('mantiene el catálogo como consulta y no permite crear integrantes por POST', async () => {
    const response = await request(app)
      .post('/api/team-members')
      .send({ code: 'TI-999', name: 'Persona' })
      .expect(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(await prisma.teamMember.count()).toBe(0);
  });

  it('mantiene el CRUD actual de tareas con responsable de texto sin modificar el catálogo', async () => {
    await seedTeamMembers(prisma, initialTeamMembers);
    const membersBefore = await prisma.teamMember.findMany({ orderBy: { id: 'asc' } });
    const input = {
      title: 'Compatibilidad',
      description: null,
      responsible: 'Responsable de texto',
      status: 'PENDIENTE',
    };
    const created = await request(app).post('/api/tasks').send(input).expect(201);
    await expectDocumentedResponse(created, 'post', '/tasks');
    const updated = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .send({ ...input, responsible: 'Otro texto', status: 'COMPLETADO' })
      .expect(200);
    await expectDocumentedResponse(updated, 'put', '/tasks/{id}');
    const list = await request(app).get('/api/tasks').expect(200);
    expect(list.body).toEqual([updated.body]);
    const deleted = await request(app).delete(`/api/tasks/${created.body.id}`).expect(204);
    await expectDocumentedResponse(deleted, 'delete', '/tasks/{id}');
    expect((await request(app).get('/api/tasks').expect(200)).body).toEqual([]);
    expect(await prisma.teamMember.findMany({ orderBy: { id: 'asc' } })).toEqual(membersBefore);
  });

  it('publica la operación y el esquema del catálogo en el contrato que carga Swagger', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200);
    const operation = response.body.paths['/team-members'].get;
    expect(operation.operationId).toBe('listActiveTeamMembers');
    expect(operation.tags).toEqual(['Integrantes']);
    expect(operation.responses).toHaveProperty('200');
    expect(operation.responses).toHaveProperty('500');
    expect(response.body.components.schemas.ActiveTeamMember.additionalProperties).toBe(false);
    expect(response.body.components.schemas.ActiveTeamMember.required).toEqual([
      'id',
      'code',
      'name',
      'isActive',
    ]);
  });

  it('permite la lectura desde el origen configurado de React mediante CORS', async () => {
    const response = await request(app)
      .get('/api/team-members')
      .set('Origin', frontendOrigin)
      .expect(200);
    await expectDocumentedResponse(response, 'get', '/team-members');
    expect(response.headers['access-control-allow-origin']).toBe(frontendOrigin);
    expect(response.headers.vary).toContain('Origin');
  });
});
