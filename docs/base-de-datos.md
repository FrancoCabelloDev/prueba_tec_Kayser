# Base de datos local

[Volver al README](../README.md).

## Dónde se guardan los datos

SQLite es la base de datos. Prisma es la herramienta que el backend utiliza para
consultarla y modificarla; **Prisma no aloja los datos en un servidor externo**.
Con la configuración inicial, el archivo vive en `backend/prisma/dev.db`, dentro
de la copia del proyecto que estás ejecutando. No se comparte entre computadoras
ni entre clones distintos.

`DATABASE_URL=file:./prisma/dev.db` se resuelve siempre desde `backend`, incluso al
ejecutar los comandos desde la raíz o iniciar el backend compilado. Se admiten rutas
relativas y absolutas de archivos locales con `file:`. La configuración de la aplicación
rechaza `file://`, bases en memoria y parámetros de consulta.

## Crear, comprobar y cargar ejemplos

Configura primero los `.env` siguiendo el README y ejecuta desde la raíz:

```bash
npm run db:generate
npm run db:migrate
npm run db:status
```

La generación crea `backend/src/generated/prisma`; las migraciones crean el SQLite
y sus tablas. El script prepara el archivo y su carpeta antes de llamar a Prisma Migrate,
para evitar el error al abrir una base inexistente en Windows. Las migraciones quedan
registradas en `_prisma_migrations`; `db:migrate` aplica únicamente las pendientes.

```bash
# Opcional, después de generar y migrar
npm run db:seed
```

El seed utiliza una transacción e inserta tres tareas, una por cada estado, solo si la
tabla está vacía. Si ya hay tareas, conserva la información. Volver a ejecutarlo no
duplica ejemplos. No se entrega `dev.db` en Git: cada instalación la crea con estos comandos.

Desde la parte 10 también existe `TeamMember`, el catálogo de integrantes. Cárgalo
después de migrar con `npm run db:seed:members`: registra a Franco Cabello y Oscar
Perez sin duplicarlos ni sobrescribir integrantes existentes. No crea tareas.
[Reglas y uso del catálogo](integrantes.md).

## Consultar con DataGrip

La consulta en DataGrip es opcional; la aplicación puede utilizarse sin instalarlo.

1. En Database Explorer, agrega una fuente de datos: **New → Data Source → SQLite**.
2. En **File**, selecciona el archivo `backend/prisma/dev.db` de tu copia del proyecto.
   Si el driver aún no está instalado, pulsa **Download missing driver files**.
3. Pulsa **Test Connection** y guarda con **OK**.
4. Actualiza la fuente de datos y abre la tabla **Task**. Si no aparece, revisa la
   selección de esquemas/tablas y pulsa Synchronize o Refresh.
5. Después de guardar una tarea desde React, actualiza la vista de datos para consultar el cambio.

Ejemplo de ruta en la instalación original del candidato:

```text
C:\Dev\prueba_tec_kayser\backend\prisma\dev.db
jdbc:sqlite:C:/Dev/prueba_tec_kayser/backend/prisma/dev.db
```

La carpeta puede cambiar según dónde clonaste el repositorio: selecciona siempre
el archivo de esa copia. SQLite no requiere host, puerto, usuario ni contraseña.
[Documentación oficial de DataGrip para SQLite](https://www.jetbrains.com/help/datagrip/sqlite.html).

Puedes ejecutar esta consulta de lectura en la consola SQL:

```sql
SELECT id, title, description, responsible, status, createdAt, updatedAt
FROM "Task"
ORDER BY createdAt DESC, id DESC;
```

Para ver los integrantes, actualiza la fuente de datos y abre **TeamMember** o ejecuta:

```sql
SELECT id, code, name, isActive, createdAt, updatedAt
FROM "TeamMember"
ORDER BY code;
```

SQLite muestra `isActive` como `1` (activo) o `0` (inactivo). En esta fase `Task`
todavía conserva su responsable de texto; la relación se añadirá en la parte 12.

La tabla se llama `Task` porque el modelo Prisma representa una tarea en singular.
Es una convención válida; contiene todas las filas de tareas. `_prisma_migrations`
pertenece al historial de migraciones. Eliminar desde React quita definitivamente
la fila de `Task`; no existe un campo de eliminación lógica.

## Prisma Studio

Para la versión Prisma 7.10.0 utilizada en este proyecto, abre una terminal en **backend**:

```bash
cd backend
npx prisma studio --port 5555 --browser none --url "file://./prisma/dev.db"
```

Abre [http://127.0.0.1:5555](http://127.0.0.1:5555), selecciona `Task` y actualiza sus
datos después de crear o editar desde React. Deja la terminal abierta y detén Studio
con **Ctrl+C**. Si regresas a los comandos del README desde esa terminal, usa `cd ..`.

El `--url` evita el error de reconocimiento del protocolo que presenta Studio con
la ruta `file:C:/...` generada por la configuración en Windows. Es una URL **solo para
Studio**: conserva `DATABASE_URL=file:./prisma/dev.db` en `backend/.env`.
El comando abre la ruta inicial del proyecto; si configuraste otro archivo SQLite,
selecciona ese archivo en DataGrip o adapta la ruta de Studio.

## Conservar la información

Cerrar el backend o reiniciar la computadora no elimina las tareas. Para copiar la
base, detén primero el backend y los editores SQLite y copia el archivo local a una
ubicación de respaldo. No publiques la base en Git ni ejecutes `migrate reset` como
parte de la instalación. Las pruebas automatizadas utilizan otras bases temporales.

## Modelo y restricciones

`Task` contiene `id`, `title`, `description`, `responsible`, `status`, `createdAt` y `updatedAt`.
El identificador es autoincremental; Prisma genera las fechas y actualiza `updatedAt`
cuando una tarea se modifica mediante el cliente.

| Campo         | Restricción                                            |
| ------------- | ------------------------------------------------------ |
| `title`       | Obligatorio; contenido no vacío; máximo 150 caracteres |
| `description` | Opcional; máximo 2.000 caracteres                      |
| `responsible` | Obligatorio; contenido no vacío; máximo 100 caracteres |
| `status`      | Obligatorio: `PENDIENTE`, `EN_PROCESO` o `COMPLETADO`  |

Se permiten títulos repetidos. El estado no tiene valor por defecto en la base de datos;
debe proporcionarse al crear una tarea. El formulario de React selecciona Pendiente inicialmente.

SQLite guarda los estados como texto. La migración agrega un `CHECK` para impedir
estados inválidos incluso mediante SQL directo, además de restricciones de campos
obligatorios y longitud. El índice de `createdAt` e `id` permite ordenar las tareas de
forma estable. La API valida los campos al crear y editar tareas y rechaza propiedades adicionales.
Los identificadores y las fechas son campos protegidos: no pueden enviarse en esos cuerpos.

## Cambios futuros en el esquema

La migración `20261008214754_crear_integrantes` añade únicamente `TeamMember`, sus
restricciones y sus índices. Mantiene las filas, fechas, índices y secuencia de `Task`.
El código del integrante es único; su nombre admite homónimos. Hay un índice sobre
`isActive`, `name` y `code`. Las reglas completas están en la [guía del catálogo](integrantes.md).

Para preparar una nueva migración de desarrollo:

```bash
npm run db:migrate:dev -- --name nombre_del_cambio --create-only
```

Revisa el SQL antes de aplicarlo con `npm run db:migrate`. Los `CHECK` se mantienen en
el SQL versionado porque Prisma no los representa en `schema.prisma`. Si una nueva
migración reconstruye `Task`, conserva esas restricciones. No modifiques migraciones
ya aplicadas ni uses `db push` para omitir el historial.
