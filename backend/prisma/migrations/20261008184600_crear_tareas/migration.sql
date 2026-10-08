-- TaskStatus is stored as TEXT in SQLite. CHECK enforces the enum at database level.
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsible" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_title_check" CHECK (length(trim("title")) BETWEEN 1 AND 150),
    CONSTRAINT "Task_description_check" CHECK ("description" IS NULL OR length("description") <= 2000),
    CONSTRAINT "Task_responsible_check" CHECK (length(trim("responsible")) BETWEEN 1 AND 100),
    CONSTRAINT "Task_status_check" CHECK ("status" IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO'))
);

CREATE INDEX "Task_createdAt_id_idx" ON "Task"("createdAt", "id");
