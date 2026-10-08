import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { databaseEnv } from '../config/database-env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaBetterSqlite3({ url: `file:${databaseEnv.DATABASE_PATH}` });

export const prisma = new PrismaClient({ adapter });
