import { describe, expect, it } from 'vitest';
import {
  documentedMethods,
  expectSchema,
  schemaObject,
  validatedOpenApi,
} from './helpers/openapi.js';

describe('Especificación OpenAPI', () => {
  it('es válida, documenta las cuatro operaciones y utiliza el origen del servidor actual', async () => {
    const document = await validatedOpenApi();
    expect(document.openapi).toBe('3.0.3');
    expect(document.servers).toEqual([{ url: '/api', description: expect.any(String) }]);
    expect(document.security).toEqual([]);
    expect(document.paths['/tasks']?.get?.responses).toHaveProperty('200');
    expect(document.paths['/tasks']?.post?.responses).toHaveProperty('201');
    expect(document.paths['/tasks/{id}']?.put?.responses).toHaveProperty('200');
    const deletion = document.paths['/tasks/{id}']?.delete?.responses['204'];
    expect(deletion).toEqual({ description: expect.any(String) });
  });

  it('incluye ejemplos de peticiones y respuestas que cumplen sus esquemas', async () => {
    const document = await validatedOpenApi();
    let checkedExamples = 0;

    for (const path of Object.values(document.paths)) {
      for (const method of documentedMethods) {
        const operation = path?.[method];
        if (!operation) continue;
        const requestBody = operation.requestBody;
        if (requestBody && !('$ref' in requestBody)) {
          const media = requestBody.content['application/json'];
          if (media?.schema) {
            for (const example of Object.values(media.examples ?? {})) {
              if ('$ref' in example) throw new Error('El ejemplo de petición no está resuelto.');
              expectSchema(schemaObject(media.schema), example.value);
              checkedExamples++;
            }
          }
        }
        for (const response of Object.values(operation.responses)) {
          if ('$ref' in response) throw new Error('La respuesta no está resuelta.');
          const media = response.content?.['application/json'];
          if (!media?.schema) continue;
          const schema = schemaObject(media.schema);
          if (media.example !== undefined) {
            expectSchema(schema, media.example);
            checkedExamples++;
          }
          for (const example of Object.values(media.examples ?? {})) {
            if ('$ref' in example) throw new Error('El ejemplo de respuesta no está resuelto.');
            expectSchema(schema, example.value);
            checkedExamples++;
          }
        }
      }
    }
    expect(checkedExamples).toBeGreaterThan(0);
  });

  it('distingue creación y edición y rechaza campos protegidos en ambos cuerpos', async () => {
    const document = await validatedOpenApi();
    const schemas = document.components?.schemas;
    if (!schemas?.CreateTask || !schemas.UpdateTask)
      throw new Error('Faltan los esquemas de entrada.');
    const creation = schemaObject(schemas.CreateTask);
    const update = schemaObject(schemas.UpdateTask);
    expect(creation.required).toEqual(['title', 'responsible', 'status']);
    expect(update.required).toEqual(['title', 'description', 'responsible', 'status']);
    for (const schema of [creation, update]) {
      expect(schema.additionalProperties).toBe(false);
      expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
        'description',
        'responsible',
        'status',
        'title',
      ]);
    }
  });
});
