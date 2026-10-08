# Plan de implementación: integrantes predefinidos del equipo

Este documento amplía las partes 1 a 9 ya implementadas. La parte 10 incorpora el
catálogo inicial y la parte 11 añade su consulta HTTP. La parte 12 conecta la relación
en SQLite, la API y React; las partes 13 y 14 describen trabajo pendiente.
Los commits y push de los nuevos avances serán ejecutados manualmente por el candidato.

## Objetivo y alcance

Cada tarea tendrá un responsable perteneciente al catálogo de integrantes del equipo
de TI. El backend consultará ese catálogo desde SQLite; React ofrecerá un selector
y enviará el identificador elegido. Las tareas existentes conservarán su información.

Se mantendrán React, Node.js, Express, TypeScript, Prisma, SQLite, Swagger y las
herramientas de calidad actuales. El alcance de esta ampliación comprende catálogo
inicial, consulta, asignación, migración, pruebas y documentación. La gestión de
integrantes desde una pantalla, autenticación, proyectos y múltiples equipos quedan
como ampliaciones independientes.

El candidato confirmó los integrantes **Franco Cabello** y **Oscar Perez**. Se les
asignan los códigos internos **TI-001** y **TI-002**, respectivamente. Los nombres
del seed de tareas anterior siguen siendo datos de demostración independientes.

## Reglas de negocio

1. Cada tarea tiene exactamente un responsable registrado.
2. Crear una tarea o cambiar su responsable exige un integrante existente y activo.
3. El nombre sirve para mostrar a la persona; el identificador establece la relación.
4. Dos personas pueden compartir nombre. Los nombres no serán claves únicas.
5. Desactivar un integrante conserva las tareas que ya tiene asignadas.
6. Una tarea cuyo responsable quedó inactivo puede editarse conservando esa asignación.
   Asignarla a otra persona exige que el nuevo responsable esté activo.
7. Un integrante referenciado por tareas no puede eliminarse físicamente.
8. La eliminación de tareas mantiene el comportamiento actual: física, con confirmación.
9. La API valida estas reglas aunque la petición provenga de Swagger u otro cliente.

## Modelo final

| Entidad      | Campos                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `TeamMember` | `id`, `code`, `name`, `isActive`, `createdAt`, `updatedAt`                                              |
| `Task`       | Campos actuales, sustituyendo el texto `responsible` por `responsibleId` y su relación con `TeamMember` |

`code` será un código interno único y estable, por ejemplo `TI-001`. Permite ejecutar
el seed varias veces sin duplicar integrantes y distinguir personas con el mismo nombre.
`name` tendrá contenido obligatorio y un máximo de 100 caracteres. Los identificadores
serán enteros positivos; `isActive` será booleano. Se conservarán las restricciones SQL.

La relación será uno a muchos: un integrante puede tener varias tareas y una tarea
pertenece a un integrante. Se añadirá un índice sobre `Task.responsibleId` y una
clave foránea con `onDelete: Restrict`, que impida borrar un integrante con tareas.
La condición de integrante activo se comprobará en la lógica de negocio; la clave
foránea por sí sola únicamente garantiza la existencia del integrante.

Referencias oficiales: [relaciones uno a muchos en Prisma](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/one-to-many-relations)
y [acciones referenciales](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/referential-actions).

## Contrato final de la API

### Catálogo

`GET /api/team-members` devolverá los integrantes activos, ordenados por nombre y
código. No requerirá autenticación, igual que la API actual.

```json
[{ "id": 1, "code": "TI-001", "name": "Franco Cabello", "isActive": true }]
```

El ejemplo es ilustrativo: React utilizará los identificadores devueltos por la API.

### Creación y edición de tareas

POST y PUT recibirán `responsibleId` como número entero, en lugar de un nombre libre:

```json
{
  "title": "Revisar respaldos",
  "description": null,
  "responsibleId": 1,
  "status": "PENDIENTE"
}
```

Se mantendrán los códigos exitosos 201 para creación, 200 para edición y 204 para
eliminación. PUT continuará exigiendo los cuatro campos editables completos.
Un `responsibleId` inválido, inexistente o no permitido devolverá un error 400 con
un mensaje en `error.fields.responsibleId`. Una tarea inexistente seguirá devolviendo 404.

Las respuestas de las tareas incluirán `responsibleId` y un objeto `responsible`
con `id`, `code`, `name` e `isActive`. El listado podrá mostrar al responsable actual
aunque esté inactivo. No se confiará en nombres enviados por el navegador.

## Parte 10 — Crear el catálogo y su seed

Implementada: modelo, migración nueva, catálogo confirmado, seed independiente y
38 pruebas automatizadas. [Uso y publicación del avance](integrantes.md).

Trabajo:

- Definir y revisar los integrantes iniciales y sus códigos.
- Añadir `TeamMember` al esquema Prisma y crear una migración nueva.
- Mantener `Task` y su contrato actual durante este avance.
- Crear `npm run db:seed:members`, desde la raíz, para cargar el catálogo.
- Hacer el seed idempotente usando `code`: insertar los integrantes faltantes sin
  duplicar ni sobrescribir nombres o estados de integrantes existentes.
- Ejecutar la carga independientemente de si la tabla de tareas está vacía.
- Añadir pruebas de nombres, códigos únicos y repetición segura del seed.

Verificación: migración sobre base vacía y existente, catálogo cargado dos veces sin
duplicados, datos existentes conservados y `npm run check` aprobado.

Commit manual:

```text
feat: registrar el catálogo inicial de integrantes del equipo
```

Momento del push: después de verificar la migración y el seed. Confirmar CI en verde.

## Parte 11 — Consultar integrantes desde la API

Implementada: módulo por capas, `GET /api/team-members`, contrato OpenAPI y Swagger,
con 12 pruebas HTTP nuevas. [Consulta y publicación del avance](integrantes.md#consulta-de-integrantes--parte-11).

Trabajo:

- Crear `backend/src/modules/team-members/` con rutas, controlador, servicio y repositorio.
- Implementar `GET /api/team-members` y registrarlo en `app.ts`.
- Definir explícitamente el objeto de respuesta y devolver únicamente integrantes activos.
- Documentar ruta, respuesta, lista vacía y errores en OpenAPI y Swagger.
- Añadir pruebas HTTP con SQLite real, incluido el caso de integrantes inactivos.
- Mantener el CRUD actual de tareas funcionando durante este avance.

Verificación: consulta desde Swagger, orden estable, lista vacía válida, exclusión
de inactivos, contrato validado y `npm run check` aprobado.

Commit manual:

```text
feat: consultar integrantes activos desde la API
```

Momento del push: cuando el catálogo pueda consultarse correctamente. Confirmar CI en verde.

## Parte 12 — Migrar las asignaciones y conectar el selector de React

Implementada: relación con clave foránea, migración transaccional, reglas de asignación,
selector React, contrato OpenAPI y adaptación de las pruebas. [Uso y actualización](asignaciones.md).

Este avance incluirá base de datos, backend, frontend, OpenAPI y las pruebas afectadas
en el mismo commit. Cambia el contrato de las tareas; todas sus capas deben actualizarse
juntas para que la aplicación publicada siga funcionando.

### Migración de tareas existentes

- Inventariar los textos de responsables existentes y revisar sus equivalencias con
  integrantes del catálogo. No inferir identidad por similitud de nombres o por eliminar acentos.
- Resolver nombres ambiguos revisando las tareas correspondientes.
- Para responsables sin equivalencia confirmada, conservar el nombre mediante un
  registro legado inactivo, identificado con un código propio. Ese registro conserva
  la asignación histórica y no aparece entre las opciones para nuevas asignaciones.
- Crear una migración nueva que complete todas las relaciones antes de exigir
  `responsibleId NOT NULL` y retirar la columna de texto de `Task`.
- Conservar identificadores, títulos, descripciones, estados, fechas, secuencia
  autoincremental, índices y restricciones CHECK de las tareas.
- Comprobar cantidad de filas y claves foráneas antes de finalizar la migración.
- Probar primero la actualización en una base temporal con el esquema anterior y
  tareas cargadas. También comprobar la instalación nueva sin tareas ni catálogo previo.
- Antes de aplicar a la base habitual, detener los procesos que la utilizan y guardar
  una copia de respaldo. No modificar migraciones ya publicadas ni utilizar `migrate reset`.

La reconstrucción de la tabla SQLite conservará sus datos y restricciones siguiendo
el procedimiento de [cambios de esquema de SQLite](https://www.sqlite.org/lang_altertable.html).

### Backend

- Cambiar los esquemas Zod para exigir un `responsibleId` numérico válido.
- Verificar integrante y asignación dentro de la misma transacción que escribe la tarea.
- Aplicar la excepción de conservar al responsable inactivo actual al editar.
- Seleccionar y serializar los campos públicos del integrante en las respuestas.
- Traducir fallos de referencia a errores comprensibles sin exponer detalles de Prisma.
- Actualizar el seed de tareas para referenciar integrantes por sus códigos, sin asumir
  identificadores fijos ni duplicarlos. `db:seed` seguirá siendo opcional para las tareas de ejemplo.

### Frontend

- Incorporar tipos, esquema Zod y cliente HTTP para el catálogo.
- Cargar el catálogo al abrir el formulario y cancelar consultas al cerrarlo.
- Sustituir el input de responsable por un selector obligatorio, inicialmente vacío al crear.
- Transformar el valor del selector a número después de validarlo; enviar `responsibleId`.
- Precargar el identificador al editar y mostrar el nombre del responsable en las tarjetas.
- Mostrar carga, error con reintento y ausencia de integrantes activos.
- Bloquear el guardado mientras el catálogo no esté disponible; permitir cancelar el formulario.
- Si el responsable actual está inactivo, mostrarlo identificado como tal y permitir
  conservarlo únicamente en esa tarea. No ofrecerlo para crear o reasignar otras tareas.
- Mostrar los errores del backend junto al selector y conservar los valores tras un fallo.
- Distinguir nombres repetidos mediante el código del integrante y mantener accesibilidad y foco.

### OpenAPI y comprobaciones del avance

Actualizar ejemplos, cuerpos, respuestas y esquemas de Swagger, además de las pruebas
existentes que utilizan el texto `responsible`. Comprobar el CRUD desde React y Swagger,
una migración con tareas previas y una instalación nueva. `npm run check` debe pasar.

Commit manual:

```text
feat: asignar tareas a integrantes registrados
```

Momento del push: después de comprobar las capas completas y la conservación de datos.
Confirmar CI en verde para ese commit.

## Parte 13 — Consolidar las pruebas de la regla de negocio

Implementada el 8 de octubre de 2026. Además de las pruebas existentes de los avances
anteriores, se añadieron regresiones para cubrir estos escenarios:

| Escenario                                                             | Resultado esperado                                                |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Crear o reasignar con integrante activo                               | Operación exitosa                                                 |
| Identificador ausente, vacío, cero, negativo, decimal, texto u objeto | Error 400, sin escritura                                          |
| Integrante inexistente o inactivo para una nueva asignación           | Error 400 junto a `responsibleId`                                 |
| Editar otra propiedad conservando al responsable inactivo actual      | Operación exitosa                                                 |
| Reasignar una tarea de responsable inactivo a uno activo              | Operación exitosa                                                 |
| Integrante desactivado después de abrir el formulario                 | El backend rechaza una nueva asignación; React conserva los datos |
| Eliminar un integrante con tareas mediante la persistencia            | La clave foránea impide la eliminación                            |
| Borrar una tarea                                                      | No se borra su integrante ni otras tareas                         |
| Catálogo vacío, error, consulta lenta o cierre del formulario         | Interfaz comprensible y consultas canceladas                      |
| Migrar tareas antiguas y reiniciar el servidor                        | Datos y relaciones conservados                                    |
| Ejecutar el seed varias veces                                         | No duplica, reactiva ni sobrescribe integrantes                   |
| Dos integrantes con el mismo nombre                                   | Identidades y asignaciones independientes                         |

La prueba de reinicio real consulta el catálogo, asigna y reasigna una tarea y
compara la respuesta completa, incluida su relación y fechas, tras reiniciar.
Otro escenario crea una base con las dos migraciones anteriores, carga tareas con
responsables de texto y aplica la nueva migración mediante Prisma. Comprueba desde
HTTP las relaciones activas e históricas después del reinicio y la conservación de
la secuencia de identificadores. Las pruebas usan bases temporales y están incluidas
en `npm test` y `npm run check`, de modo que CI las ejecuta automáticamente.

React cubre también la precarga lenta, la cancelación real al cerrar y reabrir, el
rechazo de catálogos con identidades duplicadas y el reintento tras una baja con los
datos conservados y el foco en el selector. La [guía de verificación](verificacion.md)
registra los resultados y el recorrido sobre una base separada.

Commit manual:

```text
test: comprobar asignaciones y conservar tareas existentes
```

Momento del push: después de los controles completos y el recorrido manual. Confirmar CI en verde.

## Parte 14 — Actualizar las instrucciones y validar la entrega

Trabajo:

- Actualizar README, arquitectura, API, base de datos, solución de problemas y verificación.
- Explicar el catálogo inicial, las bajas y las asignaciones de tareas antiguas.
- Dejar claro que `db:seed:members` es necesario en una instalación nueva; el seed
  de tareas continúa siendo opcional.
- Revisar ejemplos de Swagger, respuestas y consultas de DataGrip y Prisma Studio.
- Validar una copia limpia con los `.env.example`, sin copiar la base habitual.
- Verificar también una actualización desde el esquema anterior con datos existentes.

Secuencia final prevista desde la raíz, después de clonar y copiar los `.env.example`:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed:members
npm run db:status
npm run dev
```

`db:seed:members` está disponible desde la parte 10.
Las migraciones finales deben funcionar tanto en una instalación nueva como al actualizar
una base anterior; no dependerán de que un seed opcional haya sido ejecutado previamente.

Commit manual:

```text
docs: actualizar instalación y entrega con integrantes del equipo
```

Momento del push: tras verificar instalación limpia, actualización con datos, CRUD,
Swagger y controles completos. Comprobar CI del último commit antes de la entrega.

## Publicación manual de cada avance

Después de que el avance esté verificado, el candidato ejecutará:

```bash
git status
git diff
git add <archivos_del_avance>
git diff --cached
git commit -m "<mensaje_de_la_parte>"
git push
```

Revisar los archivos agregados y los resultados de GitHub Actions antes de continuar.
Al implementar cada parte se proporcionará la lista concreta de archivos para su commit.
Este plan se incluirá en el primer avance de la ampliación.
