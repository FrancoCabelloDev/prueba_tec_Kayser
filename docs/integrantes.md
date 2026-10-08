# Catálogo de integrantes — Parte 10

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
Una migración nueva crea la tabla sin modificar `Task`. El catálogo todavía no se
consulta mediante HTTP y el formulario sigue usando un responsable de texto libre.
La parte 11 añadirá la consulta y Swagger; la parte 12 conectará las asignaciones y React.

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

`npm run db:seed` conserva su función anterior: cargar tres tareas de demostración
solo cuando `Task` está vacía. Ambos comandos son independientes en esta fase.

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

## Verificación y commit manual

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
