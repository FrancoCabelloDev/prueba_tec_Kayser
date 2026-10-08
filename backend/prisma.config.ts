import { defineConfig } from 'prisma/config';
import { databaseEnv } from './src/config/database-env.ts';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: { url: databaseEnv.DATABASE_URL },
});
