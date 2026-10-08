import { readFileSync } from 'node:fs';
import type { OpenAPIV3 } from 'openapi-types';
import { parse } from 'yaml';

export const openApiPath = new URL('../../docs/openapi.yaml', import.meta.url);
export const openApiDocument = parse(readFileSync(openApiPath, 'utf8')) as OpenAPIV3.Document;
