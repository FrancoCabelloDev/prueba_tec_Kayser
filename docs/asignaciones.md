# Asignación de tareas a integrantes

[Volver al README](../README.md). [Catálogo de integrantes](integrantes.md).

Cada tarea guarda `responsibleId`, una clave foránea hacia `TeamMember`. El frontend
elige un integrante del catálogo; la API no acepta nombres libres ni objetos de
responsable en los cuerpos de creación o edición. No hay login ni pantalla de administración.

## Reglas implementadas

- Crear o cambiar de responsable exige un integrante existente y activo.
- Editar otros datos permite conservar al responsable inactivo actual.
- Desactivar un integrante conserva sus tareas. La clave foránea con `ON DELETE RESTRICT`
  impide eliminar físicamente integrantes referenciados.
- Eliminar una tarea sigue siendo físico; conserva al integrante y las demás tareas.
- La comprobación de asignación y la escritura ocurren en una misma transacción.
- Los errores de asignación son `400`, con mensajes en `error.fields.responsibleId`.
  Una tarea inexistente responde `404`.

## Instalación y actualización

Para una instalación nueva, sigue el README y ejecuta desde la raíz:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed:members
npm run db:status
npm run dev
```

`db:seed:members` carga TI-001 — Franco Cabello y TI-002 — Oscar Perez sin duplicarlos.
Para las tres tareas opcionales de demostración, ejecuta después `npm run db:seed`.
Ese comando busca los integrantes por código, sin asumir identificadores fijos.
Si falta alguno o está inactivo y la tabla de tareas está vacía, explica el problema
y no inserta ejemplos. Si ya hay tareas, las conserva.

## Actualizar una instalación con datos

Utiliza la misma copia del proyecto y conserva sus `.env` y su archivo SQLite.
Los pasos siguientes no requieren ejecutar el seed opcional de tareas:

1. Detén frontend y backend con **Ctrl+C**. Detén también Prisma Studio y desconecta
   DataGrip de esta base después de confirmar o revertir las transacciones abiertas.
2. Guarda un respaldo del archivo que realmente utiliza `DATABASE_URL`. Para la
   ruta predeterminada, este ejemplo de PowerShell crea una carpeta de respaldo fechada:

   ```powershell
   $taskBackupDirectory = "backend/prisma/respaldo-$(Get-Date -Format yyyyMMdd-HHmmss)"
   New-Item -ItemType Directory -Path $taskBackupDirectory | Out-Null
   Copy-Item -LiteralPath 'backend/prisma/dev.db' -Destination $taskBackupDirectory
   foreach ($taskAuxiliaryFile in @('backend/prisma/dev.db-wal', 'backend/prisma/dev.db-shm', 'backend/prisma/dev.db-journal')) {
       if (Test-Path -LiteralPath $taskAuxiliaryFile) {
           Copy-Item -LiteralPath $taskAuxiliaryFile -Destination $taskBackupDirectory
       }
   }
   ```

   Copia con todas las conexiones cerradas. Si cambiaste la ruta, respalda ese archivo
   y sus auxiliares. En Linux/macOS puedes copiar los mismos archivos cerrados a una
   carpeta de respaldo distinta. Conserva el respaldo hasta comprobar la actualización.

3. Descarga los cambios y actualiza dependencias, cliente y esquema desde la raíz:

   ```bash
   git pull --ff-only
   npm ci
   npm run db:generate
   npm run db:migrate
   npm run db:seed:members
   npm run db:status
   npm run check
   npm run dev
   ```

   Antes de `git pull`, confirma o guarda tus cambios locales. Si utilizas el backend
   compilado, `npm run check` ya recompila ambos proyectos; sigue después los pasos
   de compilación local del README con el origen CORS correspondiente.

4. Comprueba que las tareas anteriores siguen visibles, con sus datos y responsables.
   Reinicia el backend y consulta otra vez. Si un responsable histórico está inactivo,
   puedes conservarlo en esa tarea o reasignarla a un integrante activo.

No uses `migrate reset`, no borres la base ni modifiques migraciones anteriores.
Si la migración falla, detente y conserva tanto la base como el respaldo; revisa el
primer error según la [guía de solución de problemas](solucion-de-problemas.md).

## Conservación de tareas anteriores

La nueva migración `20261008221600_asignar_integrantes` se ejecuta en una transacción:

1. Relaciona cada nombre antiguo únicamente con una coincidencia exacta y única en
   el catálogo existente. No compara nombres por similitud, mayúsculas ni acentos.
2. Si no existe una coincidencia única, crea un integrante histórico inactivo que
   conserva el nombre original, con un código `LEGACY-<primera tarea>-<sufijo>` disponible.
   No elige arbitrariamente entre homónimos ni ocupa códigos ya utilizados.
3. Reconstruye `Task` conservando identificadores, títulos, descripciones, estados,
   fechas, índice de ordenación, restricciones CHECK y secuencia autoincremental,
   incluso cuando se eliminaron tareas con identificadores mayores.
4. Añade el índice de `responsibleId` y la clave foránea, y comprueba cantidades de
   filas y referencias antes de finalizar.

Una base vacía se migra sin depender del seed. Los integrantes históricos no se
reactivan al ejecutar el catálogo inicial. Si el catálogo todavía no estaba cargado
al migrar tareas antiguas, sus nombres se conservan como registros históricos;
puedes reasignarlas después desde el formulario al integrante confirmado.

Un nombre antiguo escrito mediante SQL que incumpla las restricciones actuales del
catálogo detiene y revierte la migración. Debe revisarse explícitamente, sin truncarlo
o cambiarlo automáticamente.

## API y formulario

POST y PUT envían un número, por ejemplo:

```json
{
  "title": "Revisar respaldos",
  "description": null,
  "responsibleId": 1,
  "status": "PENDIENTE"
}
```

Obtén el identificador real mediante `GET /api/team-members`. La respuesta de la
tarea contiene `responsibleId` y `responsible: { id, code, name, isActive }`, además
de sus demás campos. El listado muestra el nombre y código, también para inactivos.

Al abrir el formulario, React consulta el catálogo y cancela la petición al cerrar.
Crear comienza sin integrante seleccionado. El guardado se bloquea durante carga,
error o ausencia de opciones; puedes cancelar y reintentar una consulta fallida sin
perder los textos. Los homónimos se distinguen por código. Al editar, se precarga
la asignación y puede conservarse el responsable histórico aunque no haya activos.
Los errores del backend aparecen junto al selector y conservan los valores.

En Swagger consulta primero **GET /team-members**, copia un identificador real y
utilízalo como `responsibleId` en **POST /tasks** o **PUT /tasks/{id}**.

## Consulta con DataGrip

Actualiza la fuente SQLite después de migrar. La columna de texto `Task.responsible`
se sustituye por `responsibleId`; para ver el nombre utiliza:

```sql
SELECT t.id, t.title, t.description, t.status,
       t.responsibleId, m.code, m.name, m.isActive,
       t.createdAt, t.updatedAt
FROM "Task" t
JOIN "TeamMember" m ON m.id = t.responsibleId
ORDER BY t.createdAt DESC, t.id DESC;
```

## Verificación y publicación manual

Ejecuta `npm run check`. Las pruebas adaptadas incluyen los contratos HTTP, el
selector, la precarga asíncrona, el catálogo vacío, el reintento, la conservación
de asignaciones inactivas, las claves foráneas y la migración de tareas anteriores.
La parte 13 añade regresiones de bajas posteriores a la carga, homónimos, eliminación
sin afectar otras tareas, respuestas tardías de formularios cerrados y actualización
con reinicio real. La [guía de entrega](entrega.md) consolida las instrucciones y
el [registro de verificación](verificacion.md#comprobación-de-la-parte-14) describe la comprobación desde una copia limpia.

Estos comandos corresponden al avance de la parte 12. Para la entrega final utiliza
el commit de la parte 14 en la [guía de entrega](entrega.md#commit-y-push-manuales-de-la-parte-14):

```bash
git status
git diff
git add README.md package.json backend/package.json backend/prisma backend/src/modules/tasks backend/docs/openapi.yaml backend/tests frontend/src/features frontend/src/lib frontend/tests docs
git diff --cached
git commit -m "feat: asignar tareas a integrantes registrados"
git push
```

Revisa los archivos antes del commit y comprueba los dos jobs de CI después del push.
Las bases locales, respaldos, `.env` y clientes generados están excluidos de Git.
