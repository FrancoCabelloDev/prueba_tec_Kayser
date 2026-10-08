import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { databaseEnv } from '../src/config/database-env.js';
import { prisma } from '../src/lib/prisma.js';

// Open/create the SQLite file without changing existing tables or rows.
// This also creates its parent directory for a fresh checkout.
try {
  mkdirSync(dirname(databaseEnv.DATABASE_PATH), { recursive: true });
  await prisma.$connect();
} finally {
  await prisma.$disconnect();
}
