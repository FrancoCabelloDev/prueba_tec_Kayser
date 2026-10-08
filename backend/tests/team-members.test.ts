import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initialTeamMembers } from '../prisma/team-members.data.js';
import { seedTeamMembers } from '../prisma/team-members.seed.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const testRoot = join(backendDirectory, '.test-data');
const npmCli = process.env.npm_execpath;
let temporaryDirectory: string;
let databasePath: string;
let prisma: PrismaClient;

function fileUrl(path: string) {
  return `file:${path.replaceAll('\\', '/')}`;
}

function runCommand(args: string[], path = databasePath) {
  if (!npmCli) throw new Error('Ejecuta las pruebas mediante npm run test:members o npm test.');
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd: backendDirectory,
    env: { ...process.env, DATABASE_URL: fileUrl(path) },
    encoding: 'utf8',
    timeout: 45000,
    windowsHide: true,
    stdio: 'pipe',
  });
}

function client(path: string) {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: fileUrl(path) }) });
}

beforeAll(async () => {
  mkdirSync(testRoot, { recursive: true });
  temporaryDirectory = mkdtempSync(join(testRoot, 'members-'));
  databasePath = join(temporaryDirectory, 'test.db');
  runCommand(['run', 'db:migrate']);
  prisma = client(databasePath);
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.teamMember.deleteMany();
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (temporaryDirectory) {
    const withinRoot = relative(testRoot, temporaryDirectory);
    if (!withinRoot || withinRoot.startsWith('..') || isAbsolute(withinRoot)) {
      throw new Error('Se rechazó la limpieza de una ruta ajena a las pruebas.');
    }
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

describe('Catálogo de integrantes', () => {
  it('crea una tabla vacía mediante las migraciones, sin cargar personas ni tareas automáticamente', async () => {
    expect(await prisma.teamMember.count()).toBe(0);
    expect(await prisma.task.count()).toBe(0);
  });

  it('carga desde el comando a Franco Cabello y Oscar Perez, con códigos y fechas', async () => {
    runCommand(['run', 'db:seed:members']);
    const members = await prisma.teamMember.findMany({ orderBy: { code: 'asc' } });
    expect(members).toHaveLength(2);
    expect(members.map(({ code, name, isActive }) => ({ code, name, isActive }))).toEqual([
      { code: 'TI-001', name: 'Franco Cabello', isActive: true },
      { code: 'TI-002', name: 'Oscar Perez', isActive: true },
    ]);
    for (const member of members) {
      expect(member.id).toBeGreaterThan(0);
      expect(member.createdAt).toBeInstanceOf(Date);
      expect(member.updatedAt).toBeInstanceOf(Date);
    }
    expect(await prisma.task.count()).toBe(0);
  });

  it('permite repetir el comando sin duplicar integrantes ni modificar sus fechas', async () => {
    runCommand(['run', 'db:seed:members']);
    const before = await prisma.teamMember.findMany({ orderBy: { code: 'asc' } });
    runCommand(['run', 'db:seed:members']);
    expect(await prisma.teamMember.findMany({ orderBy: { code: 'asc' } })).toEqual(before);
  });

  it('inserta únicamente códigos faltantes y conserva nombres, bajas y tareas existentes', async () => {
    const existing = await prisma.teamMember.create({
      data: {
        code: 'TI-001',
        name: 'Nombre actualizado',
        isActive: false,
        updatedAt: new Date('2026-01-02T03:04:05.000Z'),
      },
    });
    const unrelated = await prisma.teamMember.create({
      data: { code: 'TI-999', name: 'Otra persona' },
    });
    const task = await prisma.task.create({
      data: { title: 'Tarea previa', responsibleId: existing.id, status: 'EN_PROCESO' },
    });
    runCommand(['run', 'db:seed:members']);
    expect(await prisma.teamMember.count()).toBe(3);
    expect(await prisma.teamMember.findUnique({ where: { id: existing.id } })).toEqual(existing);
    expect(await prisma.teamMember.findUnique({ where: { id: unrelated.id } })).toEqual(unrelated);
    expect(await prisma.teamMember.findUnique({ where: { code: 'TI-002' } })).toMatchObject({
      name: 'Oscar Perez',
      isActive: true,
    });
    expect(await prisma.task.findMany()).toEqual([task]);
  });

  it('permite homónimos con códigos distintos y recorta espacios en los datos del seed', async () => {
    expect(
      await seedTeamMembers(prisma, [
        { code: '  TI-100  ', name: '  Ana Pérez  ' },
        { code: 'TI-101', name: 'Ana Pérez' },
      ]),
    ).toBe(2);
    expect(await prisma.teamMember.findMany({ orderBy: { code: 'asc' } })).toMatchObject([
      { code: 'TI-100', name: 'Ana Pérez', isActive: true },
      { code: 'TI-101', name: 'Ana Pérez', isActive: true },
    ]);
  });

  it('acepta los límites de longitud del código y nombre', async () => {
    const member = await prisma.teamMember.create({
      data: { code: 'T'.repeat(30), name: 'N'.repeat(100) },
    });
    expect(member.code).toHaveLength(30);
    expect(member.name).toHaveLength(100);
    expect(member.isActive).toBe(true);
  });

  it('impide códigos duplicados desde Prisma y SQL directo', async () => {
    await prisma.teamMember.create({ data: { code: 'TI-001', name: 'Primera persona' } });
    await expect(
      prisma.teamMember.create({ data: { code: 'TI-001', name: 'Segunda persona' } }),
    ).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO "TeamMember" ("code", "name") VALUES ('TI-001', 'Segunda persona')
    `).rejects.toThrow();
    expect(await prisma.teamMember.count()).toBe(1);
  });

  it.each([
    ['código vacío', { code: '', name: 'Persona' }],
    ['código con espacios', { code: '   ', name: 'Persona' }],
    ['código en minúsculas', { code: 'ti-002', name: 'Persona' }],
    ['código largo', { code: 'T'.repeat(31), name: 'Persona' }],
    ['guiones consecutivos', { code: 'TI--002', name: 'Persona' }],
    ['guion inicial', { code: '-TI-002', name: 'Persona' }],
    ['símbolo inválido', { code: 'TI@002', name: 'Persona' }],
    ['nombre vacío', { code: 'TI-002', name: '' }],
    ['nombre con espacios y saltos', { code: 'TI-002', name: ' \t\n\r ' }],
    ['nombre largo', { code: 'TI-002', name: 'N'.repeat(101) }],
    ['nombre nulo', { code: 'TI-002', name: null }],
    ['propiedad adicional', { code: 'TI-002', name: 'Persona', isActive: false }],
    ['código repetido tras recortar', { code: ' TI-001 ', name: 'Otra persona' }],
  ])(
    'rechaza %s en el catálogo antes de insertar cualquier integrante',
    async (_label, invalid) => {
      await expect(
        seedTeamMembers(prisma, [{ code: 'TI-001', name: 'Persona válida' }, invalid]),
      ).rejects.toThrow();
      expect(await prisma.teamMember.count()).toBe(0);
    },
  );

  it('rechaza un catálogo inicial vacío', async () => {
    await expect(seedTeamMembers(prisma, [])).rejects.toThrow();
    expect(await prisma.teamMember.count()).toBe(0);
  });

  it.each([
    ['código nulo', null, 'Persona', 1],
    ['código vacío', '', 'Persona', 1],
    ['código en minúsculas', 'ti-050', 'Persona', 1],
    ['código con espacios', ' TI-050 ', 'Persona', 1],
    ['código largo', 'T'.repeat(31), 'Persona', 1],
    ['guion final', 'TI-050-', 'Persona', 1],
    ['guiones consecutivos', 'TI--050', 'Persona', 1],
    ['nombre nulo', 'TI-050', null, 1],
    ['nombre vacío', 'TI-050', '', 1],
    ['nombre con espacios', 'TI-050', ' \t\n ', 1],
    ['nombre con espacios exteriores', 'TI-050', ' Persona ', 1],
    ['nombre largo', 'TI-050', 'N'.repeat(101), 1],
    ['estado nulo', 'TI-050', 'Persona', null],
    ['estado distinto de booleano', 'TI-050', 'Persona', 2],
    ['estado de texto', 'TI-050', 'Persona', 'activo'],
  ])('impide %s incluso mediante SQL directo', async (_label, code, name, isActive) => {
    await expect(prisma.$executeRaw`
      INSERT INTO "TeamMember" ("code", "name", "isActive") VALUES (${code}, ${name}, ${isActive})
    `).rejects.toThrow();
    expect(await prisma.teamMember.count()).toBe(0);
  });

  it('revierte la carga completa si ocurre un fallo de persistencia', async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "member_seed_failure" BEFORE INSERT ON "TeamMember"
      WHEN NEW.code = 'TI-002'
      BEGIN SELECT RAISE(ABORT, 'Fallo controlado de persistencia'); END
    `);
    try {
      await expect(seedTeamMembers(prisma, initialTeamMembers)).rejects.toThrow();
      expect(await prisma.teamMember.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER "member_seed_failure"');
    }
  });

  it('actualiza una base anterior conservando las tareas, sus restricciones y la secuencia', async () => {
    const legacyDirectory = join(temporaryDirectory, 'legacy');
    const legacyDatabase = join(legacyDirectory, 'legacy.db');
    const firstMigration = '20261008184600_crear_tareas';
    const migrations = join(legacyDirectory, 'migrations');
    mkdirSync(join(migrations, firstMigration), { recursive: true });
    copyFileSync(
      join(backendDirectory, 'prisma/migrations', firstMigration, 'migration.sql'),
      join(migrations, firstMigration, 'migration.sql'),
    );
    copyFileSync(
      join(backendDirectory, 'prisma/migrations/migration_lock.toml'),
      join(migrations, 'migration_lock.toml'),
    );
    const configPath = join(legacyDirectory, 'prisma.config.ts');
    writeFileSync(
      configPath,
      `import { defineConfig } from 'prisma/config';
       export default defineConfig({
         schema: ${JSON.stringify(join(backendDirectory, 'prisma/schema.prisma'))},
         migrations: { path: ${JSON.stringify(migrations)} },
         datasource: { url: ${JSON.stringify(fileUrl(legacyDatabase))} }
       });`,
    );
    new DatabaseSync(legacyDatabase).close();
    runCommand(
      ['exec', '--', 'prisma', 'migrate', 'deploy', '--config', configPath],
      legacyDatabase,
    );
    const legacy = client(legacyDatabase);
    try {
      await legacy.$executeRaw`INSERT INTO "Task" (id, title, description, responsible, status, createdAt, updatedAt)
      VALUES (37, 'Información previa', 'Conservar contenido y fechas.', 'Responsable anterior', 'COMPLETADO', 1767225600000, 1769904000000)`;
      await legacy.$executeRaw`INSERT INTO "Task" (id, title, responsible, status) VALUES (105, 'Temporal', 'Persona', 'PENDIENTE')`;
      await legacy.$executeRaw`DELETE FROM "Task" WHERE id = 105`;
      const before = await legacy.$queryRaw`SELECT * FROM "Task" ORDER BY id`;
      const schemaBefore =
        await legacy.$queryRaw`SELECT name, sql FROM sqlite_master WHERE tbl_name = 'Task' ORDER BY name`;
      const sequenceBefore =
        await legacy.$queryRaw`SELECT seq FROM sqlite_sequence WHERE name = 'Task'`;
      const catalogMigration = '20261008214754_crear_integrantes';
      mkdirSync(join(migrations, catalogMigration), { recursive: true });
      copyFileSync(
        join(backendDirectory, 'prisma/migrations', catalogMigration, 'migration.sql'),
        join(migrations, catalogMigration, 'migration.sql'),
      );
      runCommand(
        ['exec', '--', 'prisma', 'migrate', 'deploy', '--config', configPath],
        legacyDatabase,
      );
      expect(await legacy.$queryRaw`SELECT * FROM "Task" ORDER BY id`).toEqual(before);
      expect(await legacy.teamMember.count()).toBe(0);
      expect(
        await legacy.$queryRaw`SELECT name, sql FROM sqlite_master WHERE tbl_name = 'Task' ORDER BY name`,
      ).toEqual(schemaBefore);
      expect(await legacy.$queryRaw`SELECT seq FROM sqlite_sequence WHERE name = 'Task'`).toEqual(
        sequenceBefore,
      );
      runCommand(['run', 'db:seed:members'], legacyDatabase);
      runCommand(
        ['exec', '--', 'prisma', 'migrate', 'deploy', '--config', configPath],
        legacyDatabase,
      );
      expect(await legacy.teamMember.count()).toBe(2);
      expect(await legacy.$queryRaw`SELECT * FROM "Task" ORDER BY id`).toEqual(before);
    } finally {
      await legacy.$disconnect();
    }
  }, 30000);
});
