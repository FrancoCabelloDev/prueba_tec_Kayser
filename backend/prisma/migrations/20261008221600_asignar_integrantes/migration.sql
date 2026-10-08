-- Match only an exact, unique name. Preserve unmatched or ambiguous names as inactive legacy members.
-- All changes, including legacy members, are atomic. Published migrations remain unchanged.
BEGIN IMMEDIATE;
CREATE TEMP TABLE "_TaskMemberMap" (
  "name" TEXT NOT NULL PRIMARY KEY,
  "firstTaskId" INTEGER NOT NULL,
  "memberId" INTEGER,
  "legacyCode" TEXT
);
INSERT INTO "_TaskMemberMap" ("name", "firstTaskId", "memberId")
SELECT t."responsible", min(t."id"),
  CASE WHEN count(m."id") = 1 THEN min(m."id") ELSE NULL END
FROM (SELECT "responsible", min("id") AS "id" FROM "Task" GROUP BY "responsible") t
LEFT JOIN "TeamMember" m ON m."name" = t."responsible" COLLATE BINARY
GROUP BY t."responsible";
-- Pick an available code even if a previous catalog already used the preferred code.
WITH RECURSIVE candidates("name", "firstTaskId", suffix) AS (
  SELECT "name", "firstTaskId", 0 FROM "_TaskMemberMap" WHERE "memberId" IS NULL
  UNION ALL
  SELECT c."name", c."firstTaskId", c.suffix + 1 FROM candidates c
  WHERE EXISTS (
    SELECT 1 FROM "TeamMember" m
    WHERE m."code" = 'LEGACY-' || c."firstTaskId" || '-' || c.suffix
  )
)
UPDATE "_TaskMemberMap" SET "legacyCode" = (
  SELECT 'LEGACY-' || c."firstTaskId" || '-' || c.suffix FROM candidates c
  WHERE c."name" = "_TaskMemberMap"."name"
    AND NOT EXISTS (
      SELECT 1 FROM "TeamMember" m
      WHERE m."code" = 'LEGACY-' || c."firstTaskId" || '-' || c.suffix
    )
  LIMIT 1
) WHERE "memberId" IS NULL;
INSERT INTO "TeamMember" ("code", "name", "isActive")
SELECT "legacyCode", "name", false FROM "_TaskMemberMap" WHERE "memberId" IS NULL;
UPDATE "_TaskMemberMap" SET "memberId" = (
  SELECT m."id" FROM "TeamMember" m WHERE m."code" = "_TaskMemberMap"."legacyCode"
) WHERE "memberId" IS NULL;
CREATE TEMP TABLE "_TaskSequenceBackup" AS
SELECT "seq" FROM "sqlite_sequence" WHERE "name" = 'Task';
CREATE TABLE "new_Task" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "responsibleId" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_title_check" CHECK (length(trim("title")) BETWEEN 1 AND 150),
  CONSTRAINT "Task_description_check" CHECK ("description" IS NULL OR length("description") <= 2000),
  CONSTRAINT "Task_responsibleId_check" CHECK ("responsibleId" BETWEEN 1 AND 2147483647),
  CONSTRAINT "Task_status_check" CHECK ("status" IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO')),
  CONSTRAINT "Task_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("id", "title", "description", "responsibleId", "status", "createdAt", "updatedAt")
SELECT t."id", t."title", t."description", m."memberId", t."status", t."createdAt", t."updatedAt"
FROM "Task" t JOIN "_TaskMemberMap" m ON m."name" = t."responsible" COLLATE BINARY;
CREATE TEMP TABLE "_TaskMigrationCheck" ("ok" INTEGER NOT NULL CHECK ("ok" = 1));
INSERT INTO "_TaskMigrationCheck"
SELECT CASE WHEN (SELECT count(*) FROM "Task") = (SELECT count(*) FROM "new_Task")
  AND NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check('new_Task')) THEN 1 ELSE 0 END;
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_createdAt_id_idx" ON "Task"("createdAt", "id");
CREATE INDEX "Task_responsibleId_idx" ON "Task"("responsibleId");
DELETE FROM "sqlite_sequence" WHERE "name" = 'Task';
INSERT INTO "sqlite_sequence" ("name", "seq") SELECT 'Task', "seq" FROM "_TaskSequenceBackup";
INSERT INTO "_TaskMigrationCheck"
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check('Task')) THEN 1 ELSE 0 END;
DROP TABLE "_TaskMigrationCheck";
DROP TABLE "_TaskSequenceBackup";
DROP TABLE "_TaskMemberMap";
COMMIT;
