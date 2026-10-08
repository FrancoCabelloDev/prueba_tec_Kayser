import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { TaskStatus } from '../src/generated/prisma/enums.js';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const testRoot = join(backendDirectory, '.test-data');
const npmCli = process.env.npm_execpath;
const originalDatabaseUrl = process.env.DATABASE_URL;

let temporaryDirectory: string;
let databaseUrl: string;
let prisma: PrismaClient | undefined;
let responsibleId: number;

function database() {
  if (!prisma) throw new Error('La base de prueba no está inicializada.');
  return prisma;
}

function runDatabaseCommand(script: 'db:migrate' | 'db:seed' | 'db:seed:members') {
  if (!npmCli) throw new Error('Ejecuta las pruebas mediante npm run test:persistence.');
  return execFileSync(process.execPath, [npmCli, 'run', script], {
    cwd: backendDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 45000,
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  mkdirSync(testRoot, { recursive: true });
  temporaryDirectory = mkdtempSync(join(testRoot, 'persistence-'));
  databaseUrl = `file:${join(temporaryDirectory, 'test.db').replaceAll('\\', '/')}`;
  process.env.DATABASE_URL = databaseUrl;

  // The database file does not exist before this command.
  runDatabaseCommand('db:migrate');
  const module = await import('../src/lib/prisma.js');
  prisma = module.prisma;
  await prisma.$connect();
  runDatabaseCommand('db:seed:members');
  responsibleId = (await prisma.teamMember.findUniqueOrThrow({ where: { code: 'TI-001' } })).id;
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

describe('Persistencia de tareas en SQLite', () => {
  it('crea una base vacía y permite aplicar las migraciones otra vez sin perder datos', async () => {
    expect(await database().task.count()).toBe(0);
    runDatabaseCommand('db:migrate');
    expect(await database().task.count()).toBe(0);
  });

  it('crea ejemplos una sola vez y conserva los tres estados', async () => {
    runDatabaseCommand('db:seed');
    const firstRun = await database().task.findMany({ orderBy: { id: 'asc' } });
    expect(firstRun).toHaveLength(3);
    expect(firstRun.map((task) => task.status)).toEqual([
      TaskStatus.PENDIENTE,
      TaskStatus.EN_PROCESO,
      TaskStatus.COMPLETADO,
    ]);
    runDatabaseCommand('db:seed');
    expect(await database().task.findMany({ orderBy: { id: 'asc' } })).toEqual(firstRun);
  });

  it('genera el identificador y las fechas y acepta una descripción opcional', async () => {
    const task = await database().task.create({
      data: { title: 'Tarea persistente', responsibleId, status: TaskStatus.PENDIENTE },
    });
    expect(task.id).toBeGreaterThan(0);
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBeInstanceOf(Date);
    expect(task.description).toBeNull();
  });

  it('permite títulos repetidos', async () => {
    const tasks = await database().task.createMany({
      data: [
        { title: 'Título repetido', responsibleId, status: TaskStatus.PENDIENTE },
        { title: 'Título repetido', responsibleId, status: TaskStatus.COMPLETADO },
      ],
    });
    expect(tasks.count).toBe(2);
  });

  it('rechaza estados desconocidos y campos obligatorios nulos mediante SQL directo', async () => {
    expect(
      await database().$executeRaw`
      INSERT INTO "Task" ("title", "responsibleId", "status")
      VALUES ('Tarea desde SQL', ${responsibleId}, 'PENDIENTE')
    `,
    ).toBe(1);
    for (const values of [
      ['Tarea', responsibleId, 'DESCONOCIDO'],
      [null, responsibleId, 'PENDIENTE'],
      ['Tarea', null, 'PENDIENTE'],
      ['Tarea', responsibleId, null],
    ]) {
      await expect(database().$executeRaw`
        INSERT INTO "Task" ("title", "responsibleId", "status")
        VALUES (${values[0]}, ${values[1]}, ${values[2]})
      `).rejects.toThrow();
    }
  });

  it('rechaza títulos inválidos e identificadores de responsable fuera de rango', async () => {
    for (const values of [
      ['   ', responsibleId],
      ['Tarea', 0],
      ['x'.repeat(151), responsibleId],
      ['Tarea', 2147483648],
    ]) {
      await expect(database().$executeRaw`
        INSERT INTO "Task" ("title", "responsibleId", "status")
        VALUES (${values[0]}, ${values[1]}, 'PENDIENTE')
      `).rejects.toThrow();
    }
    await expect(
      database().task.create({
        data: {
          title: 'Descripción extensa',
          responsibleId,
          status: TaskStatus.PENDIENTE,
          description: 'x'.repeat(2001),
        },
      }),
    ).rejects.toThrow();
  });

  it('actualiza la fecha de modificación y mantiene el identificador y la creación', async () => {
    const initial = await database().task.create({
      data: { title: 'Editar tarea', responsibleId, status: TaskStatus.PENDIENTE },
    });
    const updated = await database().task.update({
      where: { id: initial.id },
      data: { status: TaskStatus.EN_PROCESO },
    });
    expect(updated.id).toBe(initial.id);
    expect(updated.createdAt).toEqual(initial.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(initial.updatedAt.getTime());
    expect(updated.status).toBe(TaskStatus.EN_PROCESO);
  });

  it('conserva las tareas al consultarlas desde un proceso nuevo', async () => {
    const task = await database().task.create({
      data: {
        title: 'Conservar después de reiniciar',
        responsibleId,
        status: TaskStatus.COMPLETADO,
      },
    });
    const output = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        `const { prisma } = await import('./src/lib/prisma.ts');
       try { console.log(JSON.stringify(await prisma.task.findUnique({ where: { id: ${task.id} } }))); }
       finally { await prisma.$disconnect(); }`,
      ],
      {
        cwd: backendDirectory,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: 'utf8',
        timeout: 15000,
      },
    );
    expect(JSON.parse(output)).toMatchObject({
      id: task.id,
      title: task.title,
      status: task.status,
    });
  });

  it('no sobrescribe tareas existentes al repetir el seed ni las migraciones', async () => {
    const first = await database().task.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const edited = await database().task.update({
      where: { id: first.id },
      data: { title: 'Título editado' },
    });
    const count = await database().task.count();
    runDatabaseCommand('db:seed');
    runDatabaseCommand('db:migrate');
    expect(await database().task.count()).toBe(count);
    expect(await database().task.findUnique({ where: { id: first.id } })).toEqual(edited);
  });
});
