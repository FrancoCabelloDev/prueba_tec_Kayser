import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { isAbsolute, join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const testRoot = join(backendDirectory, '.test-data');
const npmCli = process.env.npm_execpath;
type PublicMember = { id: number; code: string; name: string; isActive: boolean };
let temporaryDirectory: string;
let serverProcess: ChildProcess | undefined;
let serverOutput = '';
let baseUrl: string;
let serverEnvironment: NodeJS.ProcessEnv;

function runDatabaseCommand(args: string[]) {
  if (!npmCli) throw new Error('Ejecuta esta prueba mediante npm run test:lifecycle o npm test.');
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd: backendDirectory,
    env: serverEnvironment,
    stdio: 'pipe',
    timeout: 45000,
    windowsHide: true,
  });
}

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No se pudo reservar un puerto.');
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function stopServer() {
  const child = serverProcess;
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  // Evita dejar procesos abiertos si el cierre falla en cualquier plataforma.
  const forceStop = setTimeout(() => child.kill('SIGKILL'), 5000);
  try {
    await exited;
  } finally {
    clearTimeout(forceStop);
    serverProcess = undefined;
  }
}

async function startServer() {
  serverOutput = '';
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', join(backendDirectory, 'src/server.ts')],
    {
      cwd: backendDirectory,
      env: serverEnvironment,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  serverProcess = child;
  let spawnError: Error | undefined;
  child.once('error', (error) => {
    spawnError = error;
  });
  child.stdout?.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString();
  });

  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null || child.signalCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* El servidor todavía puede estar iniciando. */
    }
    await delay(100);
  }
  throw new Error(`El backend de prueba no pudo iniciar.\n${serverOutput}`);
}

async function callApi(path: string, method = 'GET', body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
  });
}

beforeAll(async () => {
  mkdirSync(testRoot, { recursive: true });
  temporaryDirectory = mkdtempSync(join(testRoot, 'lifecycle-'));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}/api`;
  serverEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    FRONTEND_ORIGIN: 'http://127.0.0.1:5173',
    DATABASE_URL: `file:${join(temporaryDirectory, 'test.db').replaceAll('\\', '/')}`,
  };
  runDatabaseCommand(['run', 'db:migrate']);
  runDatabaseCommand(['run', 'db:seed:members']);
  await startServer();
});

afterAll(async () => {
  await stopServer();
  if (temporaryDirectory) {
    const withinRoot = relative(testRoot, temporaryDirectory);
    if (!withinRoot || withinRoot.startsWith('..') || isAbsolute(withinRoot)) {
      throw new Error('Se rechazó la limpieza de una ruta ajena a las pruebas.');
    }
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

it('crea, consulta, edita, reinicia el backend, consulta y elimina conservando la persistencia', async () => {
  const members = (await (await callApi('/team-members')).json()) as PublicMember[];
  expect(members).toHaveLength(2);
  const franco = members.find((member) => member.code === 'TI-001')!;
  const oscar = members.find((member) => member.code === 'TI-002')!;
  const input = {
    title: 'Verificar reinicio del backend',
    description: 'Comprobar persistencia.',
    responsibleId: franco.id,
    status: 'PENDIENTE',
  };
  const createdResponse = await callApi('/tasks', 'POST', input);
  expect(createdResponse.status).toBe(201);
  const created = (await createdResponse.json()) as { id: number; createdAt: string };
  expect(created).toMatchObject({ ...input, responsible: franco });
  expect(created.id).toBeGreaterThan(0);
  const firstList = await callApi('/tasks');
  expect(firstList.status).toBe(200);
  expect(await firstList.json()).toEqual([expect.objectContaining({ ...input, id: created.id })]);

  const update = {
    ...input,
    title: 'Persistencia comprobada',
    description: null,
    responsibleId: oscar.id,
    status: 'COMPLETADO',
  };
  const editedResponse = await callApi(`/tasks/${created.id}`, 'PUT', update);
  expect(editedResponse.status).toBe(200);
  const edited = await editedResponse.json();
  expect(edited).toMatchObject({
    ...update,
    id: created.id,
    createdAt: created.createdAt,
    responsible: oscar,
  });

  await stopServer();
  await startServer();
  const afterRestart = await callApi('/tasks');
  expect(afterRestart.status).toBe(200);
  expect(await afterRestart.json()).toEqual([edited]);
  expect(await (await callApi('/team-members')).json()).toEqual(members);
  const documentation = await callApi('/openapi.json');
  expect(documentation.status).toBe(200);
  expect(await documentation.json()).toMatchObject({ openapi: '3.0.3' });

  const deleted = await callApi(`/tasks/${created.id}`, 'DELETE');
  expect(deleted.status).toBe(204);
  expect(await deleted.text()).toBe('');
  expect(await (await callApi('/tasks')).json()).toEqual([]);
  expect((await callApi(`/tasks/${created.id}`, 'PUT', update)).status).toBe(404);
  await stopServer();
  await startServer();
  expect(await (await callApi('/tasks')).json()).toEqual([]);
  expect(await (await callApi('/team-members')).json()).toEqual(members);
}, 30000);

it('actualiza una base anterior y conserva tareas, relaciones y secuencia después del reinicio real', async () => {
  await stopServer();
  const legacyDirectory = join(temporaryDirectory, 'legacy');
  const migrationDirectory = join(legacyDirectory, 'migrations');
  mkdirSync(migrationDirectory, { recursive: true });
  const databasePath = join(legacyDirectory, 'legacy.db');
  serverEnvironment = {
    ...serverEnvironment,
    DATABASE_URL: `file:${databasePath.replaceAll('\\', '/')}`,
  };
  for (const migration of ['20261008184600_crear_tareas', '20261008214754_crear_integrantes']) {
    mkdirSync(join(migrationDirectory, migration));
    copyFileSync(
      join(backendDirectory, 'prisma/migrations', migration, 'migration.sql'),
      join(migrationDirectory, migration, 'migration.sql'),
    );
  }
  copyFileSync(
    join(backendDirectory, 'prisma/migrations/migration_lock.toml'),
    join(migrationDirectory, 'migration_lock.toml'),
  );
  const configPath = join(legacyDirectory, 'prisma.config.ts');
  writeFileSync(
    configPath,
    `import { defineConfig } from 'prisma/config';
    export default defineConfig({
      schema: ${JSON.stringify(join(backendDirectory, 'prisma/schema.prisma'))},
      migrations: { path: ${JSON.stringify(migrationDirectory)} },
      datasource: { url: ${JSON.stringify(serverEnvironment.DATABASE_URL)} }
    });`,
  );
  new DatabaseSync(databasePath).close();
  runDatabaseCommand(['exec', '--', 'prisma', 'migrate', 'deploy', '--config', configPath]);
  runDatabaseCommand(['run', 'db:seed:members']);
  const legacy = new DatabaseSync(databasePath);
  let oldTasks: Record<string, unknown>[];
  let oldMembers: Record<string, unknown>[];
  try {
    legacy.exec(`
      INSERT INTO "Task" (id, title, description, responsible, status, createdAt, updatedAt)
      VALUES (37, 'Tarea anterior activa', 'Conservar contenido.', 'Franco Cabello', 'COMPLETADO', 1767225600000, 1769904000000),
             (42, 'Tarea anterior histórica', NULL, 'Responsable anterior', 'EN_PROCESO', 1767225600000, 1769904000000);
      INSERT INTO "Task" (id, title, responsible, status) VALUES (105, 'Temporal eliminada', 'Franco Cabello', 'PENDIENTE');
      DELETE FROM "Task" WHERE id = 105;
    `);
    oldTasks = legacy.prepare('SELECT * FROM "Task" ORDER BY id').all();
    oldMembers = legacy.prepare('SELECT * FROM "TeamMember" ORDER BY id').all();
  } finally {
    legacy.close();
  }

  runDatabaseCommand(['run', 'db:migrate']);
  const migrated = new DatabaseSync(databasePath);
  let expectedTasks: Record<string, unknown>[];
  let migratedMembers: Record<string, unknown>[];
  try {
    migratedMembers = migrated.prepare('SELECT * FROM "TeamMember" ORDER BY id').all();
    expect(migratedMembers).toEqual([
      ...oldMembers,
      expect.objectContaining({ name: 'Responsable anterior', isActive: 0 }),
    ]);
    expectedTasks = oldTasks.map(({ responsible, ...task }) => {
      const member = migratedMembers.find((item) => item.name === responsible)!;
      return {
        ...task,
        createdAt: new Date(Number(task.createdAt)).toISOString(),
        updatedAt: new Date(Number(task.updatedAt)).toISOString(),
        responsibleId: member.id,
        responsible: {
          id: member.id,
          code: member.code,
          name: member.name,
          isActive: Boolean(member.isActive),
        },
      };
    });
    expect(migrated.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get('Task')).toEqual({
      seq: 105,
    });
    expect(migrated.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(migrated.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
  } finally {
    migrated.close();
  }
  // Repetir los comandos de instalación no debe alterar las asignaciones históricas.
  runDatabaseCommand(['run', 'db:migrate']);
  runDatabaseCommand(['run', 'db:seed:members']);
  const repeated = new DatabaseSync(databasePath);
  try {
    expect(repeated.prepare('SELECT * FROM "TeamMember" ORDER BY id').all()).toEqual(
      migratedMembers,
    );
  } finally {
    repeated.close();
  }
  await startServer();
  const members = (await (await callApi('/team-members')).json()) as PublicMember[];
  expect(members.map((member) => member.code)).toEqual(['TI-001', 'TI-002']);
  const first = await callApi('/tasks');
  expect(first.status).toBe(200);
  // Ambas tareas tienen la misma fecha; el contrato ordena por id descendente.
  expect(await first.json()).toEqual([...expectedTasks].reverse());
  await stopServer();
  await startServer();
  expect(await (await callApi('/tasks')).json()).toEqual([...expectedTasks].reverse());
  expect(await (await callApi('/team-members')).json()).toEqual(members);
  const created = await callApi('/tasks', 'POST', {
    title: 'Continuar después de migrar',
    responsibleId: members[0]!.id,
    status: 'PENDIENTE',
  });
  expect(created.status).toBe(201);
  expect(await created.json()).toMatchObject({ id: 106, responsible: members[0] });
  await callApi('/tasks/106', 'DELETE').then((response) => expect(response.status).toBe(204));
  expect(await (await callApi('/tasks')).json()).toEqual([...expectedTasks].reverse());
}, 60000);
