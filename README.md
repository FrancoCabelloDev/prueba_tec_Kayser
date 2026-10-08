# Gestión de tareas del equipo de TI

Aplicación con React y Node.js para registrar, consultar, editar y eliminar tareas.
Cada tarea contiene título, descripción, responsable y uno de estos estados: Pendiente,
En Proceso o Completado.

## Avance actual

Las partes 1 a 8 del plan están implementadas: frontend y backend con TypeScript,
npm workspaces, ESLint, Prettier, persistencia con Prisma y SQLite y una API para
listar, crear, editar y eliminar tareas. El frontend permite completar las cuatro operaciones. El backend verifica
la conexión y las tablas al arrancar y ofrece un endpoint de salud.

La API incluye validaciones con Zod, CORS para el origen del frontend, manejo centralizado
de errores y pruebas de integración sobre una base temporal. La base incluye una
migración versionada, restricciones de datos, un seed opcional y pruebas de persistencia.
La API está documentada con OpenAPI y Swagger UI. El listado de React incluye estados
de carga, lista vacía y error, además de actualización y reintento. Un formulario reutilizable
con React Hook Form y Zod permite crear y editar, y un diálogo identifica la tarea antes de
confirmar su eliminación. La parte 8 incorpora una prueba con reinicio real del backend
y un workflow de GitHub Actions para verificar el proyecto en Windows y Linux.
La ejecución remota del workflow se confirma después de publicar los cambios manualmente.

## Requisitos

- Node.js 24 LTS. Versión usada para verificar este avance: **24.21.0**.
- npm 11 o superior. Versión usada: **11.19.0**.
- Git para clonar y publicar el proyecto.

El archivo `.nvmrc` especifica la versión de Node. Si utilizas un administrador de versiones,
selecciona esa versión antes de instalar. SQLite se guarda en un archivo local;
no se necesita instalar un servidor de base de datos.

## Instalación

Desde la raíz del repositorio:

```bash
npm ci
```

La instalación utiliza `package-lock.json` e incluye ambos workspaces. No es necesario
instalar dependencias por separado en `frontend` y `backend`.

### Variables de entorno

En PowerShell, desde la raíz:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

En Linux o macOS:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Si los archivos `.env` ya existen, revisa sus valores en lugar de sobrescribirlos.

| Archivo         | Variable          | Valor de ejemplo            | Propósito                                                       |
| --------------- | ----------------- | --------------------------- | --------------------------------------------------------------- |
| `frontend/.env` | `VITE_API_URL`    | `http://127.0.0.1:3000/api` | URL pública de la API                                           |
| `backend/.env`  | `PORT`            | `3000`                      | Puerto de la API, entre 1 y 65535                               |
| `backend/.env`  | `NODE_ENV`        | `development`               | `development`, `test` o `production`; por defecto `development` |
| `backend/.env`  | `FRONTEND_ORIGIN` | `http://127.0.0.1:5173`     | Origen del frontend permitido por CORS                          |
| `backend/.env`  | `DATABASE_URL`    | `file:./prisma/dev.db`      | Archivo SQLite relativo al directorio backend                   |

`VITE_API_URL`, `PORT`, `FRONTEND_ORIGIN` y `DATABASE_URL` son obligatorias. La configuración rechaza
valores inválidos con un mensaje claro al iniciar o compilar según el proyecto.
`FRONTEND_ORIGIN` debe contener solo el origen, sin ruta ni barra final.

Los archivos `.env` son locales y están excluidos de Git. Las variables que comienzan
con `VITE_` se incluyen en el frontend y son públicas; no deben contener secretos.

Si ya configuraste el proyecto en la parte 1, conserva tu `backend/.env` y agrega:

```dotenv
DATABASE_URL=file:./prisma/dev.db
```

La ruta SQLite se resuelve siempre desde `backend`, tanto en las migraciones como en
la aplicación compilada, independientemente del directorio desde donde se invoquen.
Se admiten rutas relativas y rutas absolutas locales con el prefijo `file:`. No se
utilizan URLs `file://`, bases en memoria ni parámetros de consulta.

### Crear y configurar la base de datos

Después de configurar el entorno, ejecuta desde la raíz:

```bash
npm run db:generate
npm run db:migrate
```

El primer comando genera el cliente tipado en `backend/src/generated/prisma`.
El segundo prepara el archivo SQLite y aplica únicamente las migraciones pendientes.
Si el archivo o su carpeta todavía no existen, se crean automáticamente. Si ya existen,
no se eliminan tablas ni filas. Con el valor de ejemplo se utiliza `backend/prisma/dev.db`.

La preparación explícita del archivo evita un problema de la CLI de Prisma 7 al detectar
una base SQLite inexistente en Windows. Las migraciones siguen siendo aplicadas y
registradas por Prisma Migrate.

Para verificar el estado de las migraciones:

```bash
npm run db:status
```

Puedes volver a ejecutar `db:migrate`: las migraciones aplicadas no se repiten y los
datos existentes se conservan. Los comandos de base de datos solo requieren
`DATABASE_URL`; no dependen de los puertos del servidor.

### Datos de ejemplo opcionales

```bash
npm run db:seed
```

El seed agrega tres tareas, una por cada estado, únicamente si la tabla está vacía.
La operación es transaccional. Si ya existe cualquier tarea, no modifica ni sobrescribe
datos. Por eso se puede ejecutar varias veces sin duplicar ejemplos.

### Modelo y restricciones

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

### Cambios futuros en el esquema

Para preparar una nueva migración de desarrollo:

```bash
npm run db:migrate:dev -- --name nombre_del_cambio --create-only
```

Revisa el SQL antes de aplicarlo con `npm run db:migrate`. Los `CHECK` se mantienen en
el SQL versionado porque Prisma no los representa en `schema.prisma`. Si una nueva
migración reconstruye `Task`, conserva esas restricciones. No modifiques migraciones
ya aplicadas ni uses `db push` para omitir el historial.

## Desarrollo

Inicia ambos proyectos desde la raíz:

```bash
npm run dev
```

- Frontend: <http://127.0.0.1:5173>
- Salud de la API: <http://127.0.0.1:3000/api/health>
- Swagger UI: <http://127.0.0.1:3000/api/docs/>
- Contrato OpenAPI en JSON: <http://127.0.0.1:3000/api/openapi.json>

El endpoint de salud devuelve `200` con este JSON:

```json
{ "status": "ok" }
```

El frontend y el backend se actualizan al cambiar sus archivos. Usa `Ctrl+C` para detenerlos.
También puedes iniciarlos en terminales separadas con `npm run dev:frontend` y
`npm run dev:backend`. Si una terminal falla, el comando conjunto detiene ambos procesos.

Vite utiliza el puerto 5173 y falla si está ocupado, para conservar el origen documentado.
Si cambias el puerto del backend, actualiza también `VITE_API_URL` y reinicia el frontend.
Si cambias el origen del frontend, actualiza `FRONTEND_ORIGIN` y reinicia el backend.
`localhost` y `127.0.0.1` son orígenes diferentes: utiliza las URLs documentadas de forma consistente.

## Listado de tareas en React (parte 6)

Con la base migrada y ambos servidores iniciados, abre <http://127.0.0.1:5173>.
La pantalla consulta `GET /api/tasks` y muestra título, descripción, responsable y estado.
Respeta el orden recibido de la API; los estados se presentan como Pendiente, En Proceso
y Completado. Una descripción nula se muestra como **Sin descripción**. Los textos largos
se ajustan a las tarjetas y las descripciones conservan los saltos de línea.

- **Cargando:** anuncia la consulta y deshabilita Actualizar mientras está pendiente.
- **Sin tareas:** explica que la lista está vacía y permite Crear primera tarea.
- **Error:** muestra un mensaje comprensible y ofrece Reintentar.
- **Con tareas:** muestra las tarjetas y el total; Actualizar vuelve a consultar la API.

Las peticiones HTTP se concentran en `frontend/src/features/tasks/tasks.api.ts`, que utiliza
`VITE_API_URL`. Los componentes no contienen URLs ni llamadas a `fetch`. Zod verifica el
formato de las respuestas antes de mostrarlas. El hook `useTasks` gestiona los estados y
cancela las peticiones al desmontarse o reemplazarse, evitando respuestas desactualizadas,
también durante las comprobaciones adicionales de React StrictMode en desarrollo.

El diseño utiliza dos columnas en escritorio y una en pantallas de hasta 700 px.
Los estados incluyen texto además de color; la carga y los errores tienen anuncios
accesibles, y los controles de actualización y reintento se pueden usar con teclado.

### Comprobación manual

1. En una base vacía, abre el frontend y comprueba **No hay tareas registradas**.
2. Crea una tarea desde Swagger o ejecuta el seed opcional si la base sigue vacía.
3. Pulsa **Actualizar** en React y verifica los campos y los estados.
4. Detén solamente el backend con `Ctrl+C` en su terminal y pulsa **Actualizar**.
   Debe aparecer el mensaje de conexión y el botón **Reintentar**.
5. Reinicia el backend, pulsa **Reintentar** y comprueba que vuelve el listado.
6. Reduce el ancho de la ventana y comprueba que las tarjetas pasan a una columna.

Para probar el error, inicia frontend y backend en terminales separadas: el comando conjunto
`npm run dev` detiene ambos cuando uno falla. No borres tu base para comprobar el estado vacío;
puedes usar una base temporal distinta y aplicar sus migraciones.

## Crear, editar y eliminar desde React (parte 7)

**Nueva tarea** y **Crear primera tarea** abren el mismo formulario que utiliza **Editar**.
Al crear, los textos empiezan vacíos y el estado es Pendiente. Al editar, se precargan
los cuatro campos de la tarea seleccionada; una descripción nula se presenta como texto vacío.

El formulario valida título y responsable obligatorios, incluso si contienen solo espacios,
el estado seleccionado y los límites de 150, 100 y 2.000 caracteres respectivamente.
Recorta los espacios iniciales y finales antes de comprobar las longitudes. Una descripción
vacía se envía como `null`. Siempre se envían los cuatro campos editables; los identificadores
y las fechas no se incluyen en el cuerpo de creación o edición.

Los mensajes se muestran junto a cada campo con etiquetas visibles y referencias accesibles.
Los errores por campo de la API también se presentan en el formulario, junto al mensaje
general del servidor. Si el guardado falla, se conservan todos los valores para corregirlos
o reintentar. Mientras la solicitud está pendiente, se bloquean los campos, el envío,
Cancelar y el cierre con Escape para evitar duplicados o abandonar una operación en curso.

**Cancelar** o **Escape** cierran un formulario sin enviar cambios cuando no hay una solicitud
pendiente. **Eliminar** abre una confirmación con el título de la tarea y enfoca Cancelar.
Solo **Eliminar tarea** envía la petición DELETE. Un error mantiene abierta la confirmación
y conserva la tarjeta; una respuesta exitosa `204` se procesa sin intentar leer JSON.

Los diálogos utilizan el elemento HTML `dialog` con `showModal()`: el navegador gestiona
el foco y limita la interacción al diálogo abierto. Al cancelar, el foco vuelve al control
que lo abrió; si ese control desapareció al actualizar el listado, vuelve a Nueva tarea.
El formulario y la confirmación permiten usar Tab, Shift+Tab y los controles mediante teclado.

Cada operación exitosa cierra el diálogo, anuncia el resultado y vuelve a consultar el listado.
Si falla esa consulta posterior, se conserva el mensaje de éxito de la operación y aparece
Reintentar para consultar otra vez, sin repetir la escritura que ya finalizó.

### Comprobación manual del CRUD

1. Inicia frontend y backend y pulsa **Nueva tarea**.
2. Intenta crear con título y responsable vacíos, o solo con espacios, y comprueba los mensajes.
3. Selecciona la opción vacía del estado y comprueba que también se rechaza.
4. Completa los datos y pulsa **Crear tarea**; comprueba el éxito y la nueva tarjeta.
5. Recarga la página para comprobar la persistencia.
6. Pulsa **Editar**, revisa los valores precargados y cambia responsable y estado.
   Borra la descripción, guarda y comprueba **Sin descripción** en la tarjeta.
7. Abre de nuevo la edición, modifica un dato y pulsa **Cancelar**; comprueba que no se guardó.
8. Pulsa **Eliminar**, verifica el título y cancela; la tarea debe permanecer.
9. Abre de nuevo la confirmación y pulsa **Eliminar tarea**; comprueba el éxito y su desaparición.
10. Para comprobar un error de guardado, inicia ambos servidores en terminales separadas,
    completa una nueva tarea y detén solo el backend antes de enviar. Debe aparecer el error
    y conservarse el formulario. Reinicia el backend y vuelve a enviar.
11. Repite el recorrido con teclado y con una ventana estrecha.

Estas operaciones modifican la base configurada. Utiliza una tarea de prueba propia para el recorrido.

## API disponible

URL base de ejemplo: `http://127.0.0.1:3000/api`. Las solicitudes de creación y edición deben
enviar `Content-Type: application/json`. No se requiere autenticación.

| Método | Ruta             | Resultado                                                   |
| ------ | ---------------- | ----------------------------------------------------------- |
| GET    | `/api/health`    | `200` con `{ "status": "ok" }`                              |
| GET    | `/api/tasks`     | `200` con un arreglo de tareas; `[]` si la tabla está vacía |
| POST   | `/api/tasks`     | `201` con la tarea creada y persistida                      |
| PUT    | `/api/tasks/:id` | `200` con la tarea actualizada y persistida                 |
| DELETE | `/api/tasks/:id` | `204` sin cuerpo después de eliminar la tarea               |

El listado devuelve todas las tareas, ordenadas por `createdAt` descendente y por `id`
descendente cuando las fechas coinciden. Las fechas se serializan como cadenas ISO 8601.

### Crear una tarea

Solo se aceptan `title`, `description`, `responsible` y `status`:

```json
{
  "title": "Revisar servidor de pruebas",
  "description": "Comprobar los servicios y registrar el resultado.",
  "responsible": "Ana Pérez",
  "status": "PENDIENTE"
}
```

El backend recorta espacios al inicio y al final de los campos de texto antes de validar
las longitudes. Rechaza título o responsable vacíos, incluso si contienen solo espacios.
`description` puede omitirse, ser `null` o estar vacía; en esos casos se guarda como `null`.
El estado es obligatorio y acepta exactamente `PENDIENTE`, `EN_PROCESO` o `COMPLETADO`.
Los valores de presentación, como `Pendiente`, no son valores válidos para la API.

`id`, `createdAt` y `updatedAt` los genera el servidor. Si se envían estos campos o
cualquier propiedad adicional, la API responde `400` sin guardar la tarea.

Ejemplo de respuesta `201`:

```json
{
  "id": 1,
  "title": "Revisar servidor de pruebas",
  "description": "Comprobar los servicios y registrar el resultado.",
  "responsible": "Ana Pérez",
  "status": "PENDIENTE",
  "createdAt": "2026-10-08T12:00:00.000Z",
  "updatedAt": "2026-10-08T12:00:00.000Z"
}
```

El identificador y las fechas del ejemplo son ilustrativos.

Con el backend iniciado, puedes probarlo en PowerShell desde otra terminal:

```powershell
$taskBody = @{
    title = 'Revisar servidor de pruebas'
    description = 'Comprobar los servicios y registrar el resultado.'
    responsible = 'Ana Pérez'
    status = 'PENDIENTE'
} | ConvertTo-Json

$createdTask = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/tasks' -Method Post `
    -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($taskBody))

Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/tasks' -Method Get
```

La solicitud POST del ejemplo agrega una tarea a tu base local. También puedes utilizar
Postman con el cuerpo JSON indicado o probar las operaciones desde Swagger UI.

### Editar una tarea

`PUT /api/tasks/:id` recibe los **cuatro campos editables completos**: `title`,
`description`, `responsible` y `status`. Aplica los mismos tipos, estados, longitudes
y recorte de espacios que la creación. Para quitar la descripción, envía `null` o texto vacío;
omitirla es un error `400`. Las solicitudes parciales no están admitidas.

El identificador de la URL debe ser un entero decimal entre `1` y `2147483647`, sin
ceros iniciales. No se admiten negativos, decimales, signos, espacios, notación exponencial
ni cadenas mixtas como `12abc`. Esta regla se aplica tanto al editar como al eliminar.
Un identificador inválido devuelve `400` con mensajes en `error.fields.id`.
Un identificador válido que no corresponde a una tarea devuelve `404` con `TASK_NOT_FOUND`.

Al editar, se conservan `id` y `createdAt` y Prisma actualiza `updatedAt`. Se puede cambiar
entre cualquiera de los tres estados. Enviar `id`, `createdAt`, `updatedAt` u otra propiedad
adicional en el cuerpo devuelve `400` y conserva los datos originales.

Para editar la tarea creada en el ejemplo anterior, usa la misma terminal de PowerShell:

```powershell
$updatedTaskBody = @{
    title = 'Revisión del servidor finalizada'
    description = $null
    responsible = 'Ana Pérez'
    status = 'COMPLETADO'
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/tasks/$($createdTask.id)" -Method Put `
    -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($updatedTaskBody))

Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/tasks' -Method Get
```

La respuesta `200` contiene la tarea completa, con el mismo formato de la creación.

### Eliminar una tarea

`DELETE /api/tasks/:id` elimina definitivamente la tarea indicada; no requiere un cuerpo.
La respuesta exitosa es `204` sin JSON ni contenido. Eliminar o editar de nuevo esa tarea
devuelve `404` con `TASK_NOT_FOUND`. Las demás tareas se conservan.

Para eliminar la tarea del ejemplo y comprobar el listado:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/tasks/$($createdTask.id)" -Method Delete
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/tasks' -Method Get
```

El frontend muestra una confirmación con el título antes de enviar esta operación.

### Respuestas de error

Todos los errores usan un objeto `error` con `code` y `message`. Las validaciones agregan
`fields`, que contiene arreglos de mensajes por campo; `body` identifica un problema del
objeto completo o de propiedades adicionales. Los mensajes se devuelven en español.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revisa los campos enviados.",
    "fields": {
      "title": ["El título es obligatorio."]
    }
  }
}
```

| HTTP | Código                 | Causa                                                             |
| ---- | ---------------------- | ----------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | Identificador inválido o campos ausentes, inválidos o adicionales |
| 400  | `INVALID_JSON`         | JSON mal formado o un valor JSON primitivo                        |
| 400  | `INVALID_PATH`         | La ruta contiene una codificación de URL inválida                 |
| 404  | `TASK_NOT_FOUND`       | La tarea que se intenta editar o eliminar no existe               |
| 404  | `ROUTE_NOT_FOUND`      | Ruta o combinación de ruta y método inexistente                   |
| 413  | `PAYLOAD_TOO_LARGE`    | Cuerpo superior al límite de 16 KB                                |
| 415  | `UNSUPPORTED_ENCODING` | Charset o codificación de contenido no soportados                 |
| 500  | `INTERNAL_ERROR`       | Fallo inesperado al procesar la solicitud                         |

Los errores inesperados se registran en la consola del backend. La respuesta pública
omite detalles de Prisma, SQL y trazas internas. Las validaciones fallidas no escriben
en la base de datos. Al editar y eliminar, el repositorio traduce el error de registro
inexistente de Prisma (`P2025`) a un resultado que el servicio convierte en `404`.
La operación se ejecuta directamente sobre el identificador, sin una consulta previa
de existencia que pueda quedar desactualizada entre solicitudes concurrentes.

### CORS

La API responde con permisos CORS únicamente cuando `Origin` coincide con
`FRONTEND_ORIGIN`. Las solicitudes preflight del navegador se atienden automáticamente.
Los métodos permitidos son `GET`, `POST`, `PUT` y `DELETE`.
Las herramientas sin `Origin`, como Postman o los scripts, pueden utilizar la API.
CORS controla el acceso a las respuestas desde el navegador; no sustituye autenticación.

## OpenAPI y Swagger UI

La especificación explícita está en `backend/docs/openapi.yaml`, con OpenAPI 3.0.3.
Incluye las cuatro operaciones CRUD, el endpoint de salud, los parámetros de ruta,
los campos obligatorios, estados y límites, los esquemas de tareas y errores y ejemplos
de peticiones y respuestas. La creación y la edición tienen esquemas separados porque
la descripción es opcional al crear y obligatoria, aunque admite `null`, al editar.

Con la base configurada y migrada, inicia el backend desde la raíz:

```bash
npm run dev:backend
```

Abre <http://127.0.0.1:3000/api/docs/>. La ruta `/api/docs` redirige a la URL con barra final.
Swagger obtiene el contrato desde `/api/openapi.json`; ambos se generan a partir del mismo
archivo YAML. Los recursos de la interfaz se sirven desde las dependencias locales,
sin utilizar una CDN ni enviar la especificación a un validador externo.

### Probar el CRUD desde Swagger

1. Abre **POST /tasks**, pulsa **Try it out**, revisa el JSON de ejemplo y pulsa **Execute**.
   Debe responder `201`. Conserva el `id` que aparece en la respuesta.
2. Ejecuta **GET /tasks**. Debe responder `200` y mostrar la tarea creada.
3. Abre **PUT /tasks/{id}**, pulsa **Try it out**, introduce ese identificador y envía los
   cuatro campos completos. Debe responder `200` con los datos actualizados.
4. Ejecuta de nuevo **GET /tasks** para consultar el cambio.
5. Ejecuta **DELETE /tasks/{id}** con ese identificador. Debe responder `204` sin cuerpo.
6. Consulta **GET /tasks** para comprobar que desapareció. Repetir la eliminación devuelve `404`.

Las operaciones ejecutadas desde Swagger utilizan la base configurada en `DATABASE_URL`:
crear, editar y eliminar modifican los datos locales igual que cualquier cliente de la API.
Utiliza una tarea de ejemplo propia para este recorrido.

El servidor de OpenAPI usa la URL relativa `/api`, por lo que Swagger utiliza el mismo
origen y puerto del backend. Si cambias `PORT`, abre Swagger en ese nuevo puerto;
no necesitas modificar el YAML. También funciona al ejecutar `npm run start:backend`
después de compilar. Conserva `backend/docs/openapi.yaml` junto al proyecto: el backend
lo carga mediante una ruta relativa al módulo, independiente del directorio de trabajo.

### Verificar y mantener el contrato

```bash
npm run docs:validate
npm run test:docs
npm run test:api
```

`docs:validate` comprueba la estructura OpenAPI y las referencias internas. No necesita
iniciar el backend ni configurar una base de datos. `test:docs` comprueba los ejemplos
y esquemas de entrada. Las pruebas HTTP verifican la publicación del contrato, la página
y los recursos de Swagger, y contrastan respuestas reales del CRUD con los esquemas
documentados, incluidos los errores y el `204` sin cuerpo.

Si cambias rutas, campos, reglas o respuestas, actualiza el YAML y ejecuta `npm run check`.
Swagger documenta y permite probar la API; la validación de las solicitudes sigue siendo
responsabilidad de Zod y de las restricciones de la base.

## Comandos de calidad y compilación

| Comando desde la raíz      | Función                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `npm run lint`             | Verifica reglas de ESLint sin modificar archivos                                   |
| `npm run typecheck`        | Comprueba tipos del frontend y backend                                             |
| `npm run format:check`     | Verifica el formato sin modificar archivos                                         |
| `npm run format`           | Aplica el formato de Prettier                                                      |
| `npm run build`            | Comprueba tipos y compila ambos proyectos                                          |
| `npm run test:persistence` | Verifica migraciones, restricciones, seed y persistencia                           |
| `npm run test:api`         | Verifica las cuatro operaciones, validaciones, errores y CORS por HTTP             |
| `npm run docs:validate`    | Valida la especificación OpenAPI y sus referencias                                 |
| `npm run test:docs`        | Comprueba los ejemplos y esquemas de la documentación                              |
| `npm run test:frontend`    | Verifica listado, CRUD, validaciones, confirmación, errores y cancelación en React |
| `npm run test:lifecycle`   | Comprueba el CRUD por HTTP y la persistencia después de reiniciar el backend       |
| `npm test`                 | Ejecuta todas las pruebas del frontend y backend                                   |
| `npm run check`            | Ejecuta lint, formato, validación OpenAPI, tipos, compilación y todas las pruebas  |

Las pruebas del frontend usan Vitest, jsdom y React Testing Library, con respuestas HTTP
simuladas para comprobar fallos y solicitudes pendientes de forma reproducible. Verifican
los cuatro campos, los estados, la actualización, la recuperación de errores, respuestas
incompatibles y la cancelación que evita mostrar respuestas antiguas. También cubren creación,
edición precargada, campos obligatorios y longitudes, recorte de textos, descripción nula,
conservación de valores tras un error, validaciones del servidor, confirmación de eliminación,
cancelación, bloqueo durante solicitudes y recuperación de un error al recargar después de guardar.
jsdom utiliza una adaptación mínima de `showModal` y `close`; el foco modal y el teclado
se comprueban también en el navegador real. No requieren servidores en ejecución.
Puedes ejecutarlas con `npm run test:frontend`.

Las pruebas del backend usan una base temporal aislada bajo `backend/.test-data`, que se elimina
al finalizar. No utilizan ni modifican `dev.db`. Verifican la instalación desde un archivo
inexistente, la repetición segura de migraciones y seed, los campos obligatorios,
los estados y longitudes inválidos, títulos repetidos, fechas y lectura desde un proceso nuevo.
Las pruebas HTTP usan Supertest con Express y SQLite real para comprobar las respuestas
y los datos guardados. Solo los fallos internos se simulan para verificar la respuesta `500`.
También verifican que la edición conserve los campos protegidos, que las operaciones
afecten solo a la tarea indicada, los identificadores inválidos, las tareas inexistentes
y el flujo completo de crear, editar, consultar y eliminar.

La prueba `test:lifecycle` inicia un servidor real en un puerto disponible y usa su propia
base temporal. Crea, consulta y edita una tarea, reinicia el proceso y vuelve a consultarla.
Después la elimina y reinicia de nuevo para comprobar que no reaparece. También verifica
que OpenAPI siga disponible tras el reinicio. Está incluida en `npm test` y `npm run check`.

## Verificación y GitHub Actions (parte 8)

El workflow `.github/workflows/ci.yml` se ejecuta en cada push, pull request y ejecución
manual. Utiliza Node desde `.nvmrc`, instala con `npm ci` y verifica lint, formato,
OpenAPI, tipos, todas las pruebas y la compilación de ambos proyectos. La matriz ejecuta
los controles en `ubuntu-latest` y `windows-latest` para detectar diferencias de plataforma.

Las acciones están fijadas por SHA, el token solo tiene permiso de lectura del código y
la caché conserva descargas de npm. Las variables del workflow son valores de prueba;
no necesita secretos ni archivos `.env`. Las pruebas crean sus propias bases temporales.

El recorrido manual completo y los pasos para revisar una ejecución remota están en
[docs/verificacion.md](docs/verificacion.md). Después del push, abre **Actions → CI**
en GitHub y comprueba que ambos trabajos de calidad del commit publicado estén verdes.
Si alguno falla, revisa el primer paso fallido, corrige el problema y vuelve a publicar
manualmente. Los controles locales no sustituyen esta comprobación remota.

Las salidas se generan en `frontend/dist` y `backend/dist`, y no se incluyen en Git.

Después de compilar, puedes comprobar las salidas en dos terminales:

```bash
npm run start:backend
```

```bash
npm run preview:frontend
```

La vista previa del frontend está en <http://127.0.0.1:4173>. Es una comprobación local
de la compilación; no constituye un despliegue de producción.
Para consumir la API desde esa vista previa, configura `FRONTEND_ORIGIN=http://127.0.0.1:4173`
y reinicia el backend. Al volver al servidor de desarrollo, restaura el origen del puerto 5173.

## Estructura actual

```text
frontend/
  src/
    config/           Validación de variables públicas
    components/Modal.tsx Diálogo nativo y restauración del foco
    features/tasks/
      tasks.api.ts    CRUD HTTP centralizado y errores de la API
      tasks.schema.ts Validación de respuestas y formulario con Zod
      tasks.types.ts  Tipos y etiquetas de los estados
      hooks/useTasks.ts Estados, reintento y cancelación
      components/    Tarjetas, listado, formulario y confirmación de eliminación
    App.tsx           Listado, selección de acciones y mensajes de éxito
    main.tsx          Entrada de React
    styles.css        Estilos básicos
  vite.config.ts      Servidor y compilación
  vitest.config.ts    Entorno de pruebas de React
  tests/              Pruebas del listado, formularios, eliminación y cliente HTTP
backend/
  src/
    config/           Entorno, ruta compartida de la base y carga de OpenAPI
    errors/           Error HTTP con código, mensaje y campos opcionales
    middlewares/      Validación del cuerpo, rutas inexistentes y errores
    modules/tasks/
      task.routes.ts      Rutas GET, POST, PUT y DELETE
      task.controller.ts  Controladores: solicitudes y respuestas HTTP
      task.middleware.ts  Validación del identificador de la URL
      task.service.ts     Campos editables y tareas inexistentes
      task.repository.ts  Consultas y escritura con Prisma
      task.schema.ts      Validaciones Zod y tipo de entrada
    lib/prisma.ts     Cliente Prisma de la aplicación
    generated/prisma/ Cliente generado localmente
    app.ts            Express, CORS, rutas, Swagger UI y middlewares
    server.ts         Inicio y cierre del servidor
  prisma/
    schema.prisma     Modelo de tareas y estados
    migrations/       SQL versionado con restricciones
    ensure-database.ts Preparación del archivo SQLite
    seed.ts           Datos de ejemplo opcionales
  tests/              Pruebas de persistencia e integración de la API
    helpers/openapi.ts Validación del contrato en las pruebas HTTP
    openapi.test.ts    Validación de esquemas y ejemplos OpenAPI
    server-lifecycle.test.ts CRUD con proceso real y reinicios
  docs/openapi.yaml   Contrato explícito de la API
  scripts/validate-openapi.ts Verificación de la especificación
  prisma.config.ts    Configuración de la CLI y las migraciones
.github/workflows/ci.yml Verificaciones automáticas en Windows y Linux
docs/verificacion.md  Cobertura y recorrido manual del CRUD; revisión de CI
eslint.config.js      Reglas de JavaScript, TypeScript y React
tsconfig.base.json    Opciones compartidas de TypeScript
```

`app.ts` exporta `createApp(frontendOrigin)` y no abre un puerto. `server.ts` valida el
entorno, verifica la base y comienza a escuchar. Las pruebas configuran una base temporal
antes de importar la aplicación, sin iniciar el servidor de desarrollo.

El flujo de una creación es: ruta → validación → controlador → servicio → repositorio →
Prisma/SQLite. El controlador devuelve el resultado HTTP; el servicio normaliza la
descripción y selecciona los campos; el repositorio concentra el acceso a datos.
La edición añade la validación del identificador y exige los cuatro campos; la eliminación
valida el identificador y no necesita un formulario de datos en la API.
Express 5 dirige los errores de las funciones asíncronas al middleware central.

Prisma, su cliente y el adaptador SQLite están fijados en la misma versión estable 7.10.0.
El repositorio incluye overrides acotados para `deepmerge-ts` y `mysql2`, dependencias
indirectas de la CLI, con versiones corregidas de sus avisos de seguridad. No implican
el uso de MySQL por la aplicación. La generación, las migraciones y las pruebas verifican
la compatibilidad de esos ajustes.

## Commit y push manuales de la parte 8

Los commits y push los realiza el candidato. Git ya está inicializado; no es necesario
volver a ejecutar `git init`. Antes de publicar:

```bash
npm run check
git status
git diff
git add README.md package.json backend/package.json backend/tests/server-lifecycle.test.ts .github/workflows/ci.yml docs/verificacion.md
git diff --cached
git commit -m "test: verificar el CRUD y configurar GitHub Actions"
git push
```

Si la rama aún no tiene seguimiento remoto, utiliza `git push -u origin main` en lugar
de `git push`, después de configurar el remoto de tu repositorio.

El momento de publicar es después de comprobar el arranque y ejecutar las verificaciones.
Después del push, confirma en Actions que los dos trabajos de CI del mismo commit pasaron.
No incluyas `.env`, `node_modules`, `dist`, el cliente generado, bases locales ni los archivos internos de
generación de documentos. Los archivos originales del Word se conservan localmente.
