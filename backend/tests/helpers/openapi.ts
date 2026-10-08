import SwaggerParser from '@apidevtools/swagger-parser';
import { Ajv } from 'ajv';
import formats from 'ajv-formats';
import type { OpenAPIV3 } from 'openapi-types';
import type { Response } from 'supertest';
import { expect } from 'vitest';
import { openApiDocument } from '../../src/config/openapi.js';

export const documentedMethods = ['get', 'post', 'put', 'delete'] as const;
export type DocumentedMethod = (typeof documentedMethods)[number];

const ajv = new Ajv({ strict: false, allErrors: true });
formats.default(ajv);

const validatedDocument = SwaggerParser.validate(structuredClone(openApiDocument), {
  resolve: { external: false },
}).then((document) => document as OpenAPIV3.Document);

export function validatedOpenApi() {
  return validatedDocument;
}

export function schemaObject(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) {
  if ('$ref' in schema)
    throw new Error('La especificación validada contiene una referencia pendiente.');
  return schema;
}

export function expectSchema(schema: OpenAPIV3.SchemaObject, value: unknown) {
  const validate = ajv.compile(schema);
  expect(validate(value), ajv.errorsText(validate.errors)).toBe(true);
}

export async function expectDocumentedResponse(
  response: Response,
  method: DocumentedMethod,
  path: string,
) {
  const document = await validatedOpenApi();
  const definition = document.paths[path]?.[method]?.responses[String(response.status)];
  if (!definition || '$ref' in definition) {
    throw new Error(
      `Falta documentar la respuesta ${response.status} de ${method.toUpperCase()} ${path}.`,
    );
  }
  const schema = definition.content?.['application/json']?.schema;
  if (!schema) {
    expect(response.text).toBe('');
    return;
  }
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expectSchema(schemaObject(schema), response.body);
}
