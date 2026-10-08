CREATE TABLE "TeamMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_code_check" CHECK (
        length("code") BETWEEN 1 AND 30
        AND "code" NOT GLOB '*[^A-Z0-9-]*'
        AND "code" NOT LIKE '-%'
        AND "code" NOT LIKE '%-'
        AND instr("code", '--') = 0
    ),
    CONSTRAINT "TeamMember_name_check" CHECK (
        length("name") BETWEEN 1 AND 100
        AND length(trim("name", char(9) || char(10) || char(11) || char(12) || char(13) || ' ')) > 0
        AND "name" = trim("name", char(9) || char(10) || char(11) || char(12) || char(13) || ' ')
    ),
    CONSTRAINT "TeamMember_isActive_check" CHECK ("isActive" IN (0, 1))
);

CREATE UNIQUE INDEX "TeamMember_code_key" ON "TeamMember"("code");
CREATE INDEX "TeamMember_isActive_name_code_idx" ON "TeamMember"("isActive", "name", "code");
