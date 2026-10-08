import SwaggerParser from '@apidevtools/swagger-parser';
import { openApiDocument } from '../src/config/openapi.js';

await SwaggerParser.validate(structuredClone(openApiDocument), {
  resolve: { external: false },
});

console.info('La especificación backend/docs/openapi.yaml es válida.');
