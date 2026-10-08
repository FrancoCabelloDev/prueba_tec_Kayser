import { parseFrontendEnv } from './env.schema';

export const env = parseFrontendEnv(import.meta.env);
