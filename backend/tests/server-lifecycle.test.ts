import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { isAbsolute, join, relative } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const testRoot = join(backendDirectory, '.test-data');
let temporaryDirectory: string;
let serverProcess: ChildProcess | undefined;
let serverOutput = '';
let baseUrl: string;
let serverEnvironment: NodeJS.ProcessEnv;

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
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Ejecuta esta prueba mediante npm run test:lifecycle o npm test.');
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
  execFileSync(process.execPath, [npmCli, 'run', 'db:migrate'], {
    cwd: backendDirectory,
    env: serverEnvironment,
    stdio: 'pipe',
    timeout: 45000,
    windowsHide: true,
  });
  execFileSync(process.execPath, [npmCli, 'run', 'db:seed:members'], {
    cwd: backendDirectory,
    env: serverEnvironment,
    stdio: 'pipe',
    timeout: 45000,
    windowsHide: true,
  });
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
  const members = (await (await callApi('/team-members')).json()) as Array<{
    id: number;
    code: string;
  }>;
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
  expect(await editedResponse.json()).toMatchObject({
    ...update,
    id: created.id,
    createdAt: created.createdAt,
  });

  await stopServer();
  await startServer();
  const afterRestart = await callApi('/tasks');
  expect(afterRestart.status).toBe(200);
  expect(await afterRestart.json()).toEqual([
    expect.objectContaining({ ...update, id: created.id, createdAt: created.createdAt }),
  ]);
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
}, 30000);
