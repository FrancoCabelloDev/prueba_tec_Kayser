# Catálogo de integrantes

[Volver al README](../README.md). [Plan completo de la ampliación](plan-integrantes.md).

Este avance crea un catálogo predefinido en SQLite. El candidato confirmó:

| Código | Nombre         | Estado inicial |
| ------ | -------------- | -------------- |
| TI-001 | Franco Cabello | Activo         |
| TI-002 | Oscar Perez    | Activo         |

Los códigos son identificadores internos estables. Los `id` se generan en la base:
no deben suponerse valores fijos. Los integrantes no son cuentas de acceso.

## Alcance implementado

`TeamMember` contiene `id`, `code`, `name`, `isActive`, `createdAt` y `updatedAt`.
La migración de catálogo crea esta tabla sin modificar `Task`; una migración posterior
añade la relación `Task.responsibleId`. Desde la parte 11 el catálogo
activo se consulta mediante HTTP y Swagger. El formulario permite elegir un responsable
mediante un selector desde la parte 12, enviando `responsibleId` y consultando el
nombre del integrante en las respuestas. [Asignaciones y migración](asignaciones.md).

| Campo      | Regla                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| `id`       | Entero autoincremental                                                                 |
| `code`     | Único; de 1 a 30 caracteres; letras mayúsculas ASCII, números y guiones entre grupos   |
| `name`     | Obligatorio; de 1 a 100 caracteres; sin espacios exteriores; permite nombres repetidos |
| `isActive` | Booleano; inicialmente activo; SQLite lo almacena como 0 o 1                           |
| Fechas     | Generadas al insertar; Prisma actualiza `updatedAt` al modificar mediante el cliente   |

Por ejemplo, `TI-001` es válido; `ti-001`, `TI--001` y `TI-001-` se rechazan.
El SQL impone unicidad, obligatoriedad, longitudes, formato y valores booleanos.
El seed también valida el catálogo completo con Zod antes de escribir y recorta
espacios exteriores de códigos y nombres. El índice `isActive, name, code` prepara
la consulta ordenada del catálogo activo.

## Ejecutar desde la raíz

Instala las dependencias y configura los `.env` siguiendo el README. Después:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed:members
npm run db:status
```

La configuración inicial guarda los integrantes en `backend/prisma/dev.db`.
Puedes repetir `db:seed:members`: inserta únicamente códigos que faltan y conserva
nombres, estados y fechas de los existentes. No reactiva personas inactivas, no
elimina otras personas ni modifica tareas. Toda la carga utiliza una transacción:
si una inserción falla, no quedan altas parciales.

`npm run db:seed` carga tres tareas de demostración solo cuando `Task` está vacía.
Desde la parte 12 esas tareas referencian TI-001 y TI-002 por sus códigos; ambos
deben existir y estar activos. Ejecuta primero `db:seed:members`. Cargar integrantes
no crea tareas y repetir cualquiera de los comandos conserva datos existentes.

## Archivos y mantenimiento

- `backend/prisma/schema.prisma`: modelo tipado.
- `backend/prisma/migrations/20261008214754_crear_integrantes/migration.sql`: tabla y restricciones.
- `backend/prisma/team-members.data.ts`: catálogo inicial confirmado.
- `backend/prisma/team-members.seed.ts`: validación y carga transaccional por código.
- `backend/prisma/seed-members.ts`: comando y cierre de la conexión.
- `backend/tests/team-members.test.ts`: pruebas aisladas de catálogo y migración.

Para añadir otra persona al catálogo inicial, agrega un código nuevo y un nombre
en `team-members.data.ts`, revisa las pruebas del catálogo confirmado y ejecuta la
carga. Mantén cada código asociado a la misma persona. Cambiar un nombre en ese
archivo no modifica una fila ya cargada; renombrar o desactivar registros existentes
requiere una actualización explícita en la base. No hay pantalla administrativa en este alcance.

Al desactivar un integrante, sus tareas permanecen visibles y pueden conservar la
asignación al editar. Queda excluido del catálogo para nuevas asignaciones. La clave
foránea impide eliminar físicamente su fila mientras tenga tareas; cargar el catálogo
otra vez no lo reactiva. La actualización y el respaldo se explican en la
[guía de asignaciones](asignaciones.md#actualizar-una-instalación-con-datos).

## Ver los registros con DataGrip

Conéctate al archivo SQLite del proyecto según la [guía de base de datos](base-de-datos.md).
Pulsa Refresh o Synchronize en la fuente de datos y abre **TeamMember**, o ejecuta:

```sql
SELECT id, code, name, isActive, createdAt, updatedAt
FROM "TeamMember"
ORDER BY code;
```

En una instalación nueva deben aparecer los dos integrantes activos (`isActive = 1`).
`Task` conserva las tareas que tenías registradas.

## Verificación y commit manual de la parte 10

```bash
npm run test:members
npm run check
```

Las 38 nuevas pruebas usan SQLite temporal. Comprueban repetición sin cambios,
preservación de integrantes renombrados o inactivos, homónimos, restricciones SQL,
rechazo de catálogos inválidos y reversión completa ante un error. También migran
una base con el esquema anterior y verifican las filas, fechas, índices, definición
SQL y secuencia autoincremental de `Task`, incluida una secuencia mayor que sus filas.
Están incluidas automáticamente en `npm test` y GitHub Actions.

Después de verificar el avance, ejecuta manualmente desde la raíz:

```bash
git status
git diff
git add README.md package.json backend/package.json backend/prisma backend/tests/team-members.test.ts docs
git diff --cached
git commit -m "feat: registrar el catálogo inicial de integrantes del equipo"
git push
```

Revisa los archivos antes del commit. Los SQLite, `.env`, cliente generado y respaldos
locales están excluidos de Git. Después del push comprueba los dos jobs de CI en verde.

## Consulta de integrantes — Parte 11

Con el backend iniciado, abre
[GET /api/team-members](http://127.0.0.1:3000/api/team-members), o utiliza
[Swagger UI](http://127.0.0.1:3000/api/docs/): **Integrantes → GET /team-members →
Try it out → Execute**. Debe responder `200` con Franco Cabello y Oscar Perez si
siguen activos. Una base sin integrantes activos devuelve `[]`.

La respuesta contiene únicamente `id`, `code`, `name` e `isActive`. Se ordena por
nombre y, ante homónimos, por código, según la comparación de texto de SQLite.
Desactivar un integrante en la base lo excluye de la siguiente consulta, conservando
su fila. La ruta es de lectura y no crea, modifica ni elimina integrantes o tareas.
No requiere login y utiliza el mismo control CORS y middleware de errores que el CRUD.
[Contrato y ejemplos de la API](api.md#consultar-integrantes-activos).

El módulo está en `backend/src/modules/team-members/`, separado en rutas, controlador,
servicio y repositorio. La especificación está en `backend/docs/openapi.yaml`.
`backend/tests/team-members-api.test.ts` añade 12 pruebas con SQLite temporal,
incluidas respuestas contrastadas contra OpenAPI, homónimos, bajas, error 500 y
compatibilidad con el CRUD actual. Se ejecutan automáticamente en `npm test` y CI.

```bash
npm run test:members:api
npm run check
```

La parte 11 no añadió migraciones ni cambió el seed; la parte 12 incorpora una
nueva migración y la relación con tareas. Consulta la [guía de actualización](asignaciones.md).
Si utilizas
la compilación, ejecuta antes `npm run build` y reinicia el servidor compilado.

Publica manualmente este avance después de verificarlo:

```bash
git status
git diff
git add README.md package.json backend/package.json backend/src/app.ts backend/src/modules/team-members backend/docs/openapi.yaml backend/tests/team-members-api.test.ts backend/tests/openapi.test.ts docs
git diff --cached
git commit -m "feat: consultar integrantes activos desde la API"
git push
```

Los comandos anteriores se conservan como referencia de publicación de las partes
10 y 11. Para el último avance y el correo utiliza la [guía de entrega final](entrega.md).
