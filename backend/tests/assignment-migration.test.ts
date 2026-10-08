import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migration = (name: string) =>
  readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
const assignmentSql = migration('20261008221600_asignar_integrantes');
function legacyDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(migration('20261008184600_crear_tareas'));
  db.exec(migration('20261008214754_crear_integrantes'));
  return db;
}
function insertTask(db: DatabaseSync, id: number, responsible: string) {
  db.prepare(
    'INSERT INTO Task (id, title, description, responsible, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    `Tarea ${id}`,
    'Contenido conservado',
    responsible,
    'EN_PROCESO',
    1767225600000,
    1769904000000,
  );
}

describe('Migración de asignaciones', () => {
  it('migra una base vacía sin depender del seed y conserva el historial de secuencia vacío', () => {
    const db = legacyDatabase();
    try {
      db.exec(assignmentSql);
      expect(db.prepare('SELECT * FROM Task').all()).toEqual([]);
      expect(db.prepare('SELECT * FROM TeamMember').all()).toEqual([]);
      expect(db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'Task'").all()).toEqual([]);
      expect(
        db
          .prepare('PRAGMA table_info(Task)')
          .all()
          .map((column) => column.name),
      ).toEqual([
        'id',
        'title',
        'description',
        'responsibleId',
        'status',
        'createdAt',
        'updatedAt',
      ]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('conserva datos, índices, CHECK y secuencia; distingue coincidencias únicas, homónimos y códigos ocupados', () => {
    const db = legacyDatabase();
    try {
      db.exec(`INSERT INTO TeamMember (id, code, name, isActive) VALUES
        (10, 'TI-001', 'Franco Cabello', 1), (20, 'TI-002', 'Oscar Perez', 0),
        (30, 'TI-030', 'Nombre repetido', 1), (31, 'TI-031', 'Nombre repetido', 1),
        (32, 'LEGACY-39-0', 'Código ocupado', 1), (33, 'LEGACY-39-1', 'Otro código ocupado', 1)`);
      for (const [id, name] of [
        [37, 'Franco Cabello'],
        [38, 'Oscar Perez'],
        [39, 'Sin confirmar'],
        [40, 'Nombre repetido'],
        [41, 'Sin confirmar'],
      ] as const)
        insertTask(db, id, name);
      insertTask(db, 105, 'Temporal');
      db.exec('DELETE FROM Task WHERE id = 105');
      const before = db.prepare('SELECT * FROM Task ORDER BY id').all();
      const membersBefore = db.prepare('SELECT * FROM TeamMember ORDER BY id').all();
      db.exec(assignmentSql);
      const after = db
        .prepare(
          'SELECT t.*, m.name AS responsible FROM Task t JOIN TeamMember m ON m.id = t.responsibleId ORDER BY t.id',
        )
        .all();
      expect(
        after.map((task) => {
          const preserved = { ...task };
          delete preserved.responsibleId;
          return preserved;
        }),
      ).toEqual(before);
      expect(after[0]?.responsibleId).toBe(10);
      expect(after[1]?.responsibleId).toBe(20);
      expect(after[2]?.responsibleId).toBe(after[4]?.responsibleId);
      const historical = db
        .prepare(
          "SELECT code, name, isActive FROM TeamMember WHERE code LIKE 'LEGACY-%' AND isActive = 0 ORDER BY name",
        )
        .all();
      expect(historical).toEqual([
        { code: 'LEGACY-40-0', name: 'Nombre repetido', isActive: 0 },
        { code: 'LEGACY-39-2', name: 'Sin confirmar', isActive: 0 },
      ]);
      expect(db.prepare('SELECT * FROM TeamMember WHERE id <= 33 ORDER BY id').all()).toEqual(
        membersBefore,
      );
      expect(db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'Task'").get()?.seq).toBe(
        105,
      );
      expect(
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'Task' ORDER BY name",
          )
          .all(),
      ).toEqual([{ name: 'Task_createdAt_id_idx' }, { name: 'Task_responsibleId_idx' }]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(() => db.exec('DELETE FROM TeamMember WHERE id = 10')).toThrow();
      for (const [title, member, status] of [
        ['', 10, 'PENDIENTE'],
        ['T'.repeat(151), 10, 'PENDIENTE'],
        ['Tarea', 0, 'PENDIENTE'],
        ['Tarea', 9999, 'PENDIENTE'],
        ['Tarea', 10, 'INVALIDO'],
      ] as const) {
        expect(() =>
          db
            .prepare('INSERT INTO Task (title, responsibleId, status) VALUES (?, ?, ?)')
            .run(title, member, status),
        ).toThrow();
      }
      db.exec("INSERT INTO Task (title, responsibleId, status) VALUES ('Nueva', 10, 'PENDIENTE')");
      expect(db.prepare('SELECT max(id) AS id FROM Task').get()?.id).toBe(106);
    } finally {
      db.close();
    }
  });

  it('preserva nombres sin catálogo previo y no infiere identidad por mayúsculas ni acentos', () => {
    const db = legacyDatabase();
    try {
      insertTask(db, 1, 'Franco Cabello');
      insertTask(db, 2, 'franco cabello');
      insertTask(db, 3, 'Óscar Perez');
      db.exec(assignmentSql);
      expect(db.prepare('SELECT name, isActive FROM TeamMember ORDER BY id').all()).toHaveLength(3);
      expect(db.prepare('SELECT count(*) AS n FROM TeamMember WHERE isActive = 1').get()?.n).toBe(
        0,
      );
      expect(
        db
          .prepare(
            'SELECT t.id, m.name FROM Task t JOIN TeamMember m ON m.id = t.responsibleId ORDER BY t.id',
          )
          .all(),
      ).toEqual([
        { id: 1, name: 'Franco Cabello' },
        { id: 2, name: 'franco cabello' },
        { id: 3, name: 'Óscar Perez' },
      ]);
    } finally {
      db.close();
    }
  });

  it('revierte todas las escrituras si un nombre legado no cumple las restricciones del catálogo', () => {
    const db = legacyDatabase();
    try {
      insertTask(db, 1, 'Persona válida');
      insertTask(db, 2, '\t');
      const before = db.prepare('SELECT * FROM Task ORDER BY id').all();
      expect(() => db.exec(assignmentSql)).toThrow();
      db.exec('ROLLBACK');
      expect(db.prepare('SELECT * FROM Task ORDER BY id').all()).toEqual(before);
      expect(db.prepare('SELECT * FROM TeamMember').all()).toEqual([]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'new_Task'").all()).toEqual(
        [],
      );
    } finally {
      db.close();
    }
  });
});
