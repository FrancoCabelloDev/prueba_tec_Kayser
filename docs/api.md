# API y Swagger

[Volver al README](../README.md). Configura el proyecto siguiendo primero sus instrucciones.

## API disponible

URL base de ejemplo: `http://127.0.0.1:3000/api`. Las solicitudes de creación y edición deben
enviar `Content-Type: application/json`. No se requiere autenticación.

| Método | Ruta                | Resultado                                                   |
| ------ | ------------------- | ----------------------------------------------------------- |
| GET    | `/api/health`       | `200` con `{ "status": "ok" }`                              |
| GET    | `/api/team-members` | `200` con integrantes activos; `[]` si no hay               |
| GET    | `/api/tasks`        | `200` con un arreglo de tareas; `[]` si la tabla está vacía |
| POST   | `/api/tasks`        | `201` con la tarea creada y persistida                      |
| PUT    | `/api/tasks/:id`    | `200` con la tarea actualizada y persistida                 |
| DELETE | `/api/tasks/:id`    | `204` sin cuerpo después de eliminar la tarea               |

El listado devuelve todas las tareas, ordenadas por `createdAt` descendente y por `id`
descendente cuando las fechas coinciden. Las fechas se serializan como cadenas ISO 8601.

### Consultar integrantes activos

`GET /api/team-members` devuelve el catálogo activo, sin autenticación, cuerpo ni
parámetros. Ordena por `name` ascendente y desempata por `code` ascendente, usando
la comparación de texto predeterminada de SQLite (BINARY). Devuelve exclusivamente
`id`, `code`, `name` e `isActive`; no expone las fechas internas del integrante.

```json
[
  {
    "id": 1,
    "code": "TI-001",
    "name": "Franco Cabello",
    "isActive": true
  },
  {
    "id": 2,
    "code": "TI-002",
    "name": "Oscar Perez",
    "isActive": true
  }
]
```

Los identificadores del ejemplo son ilustrativos. Los clientes deben utilizar los
valores devueltos por la API. Los nombres pueden repetirse; cada código identifica
a una persona. Los inactivos se conservan en SQLite y quedan excluidos del listado.
Si el catálogo está vacío o todos están inactivos, responde `200` con `[]`.
Un fallo inesperado responde `500` con `INTERNAL_ERROR` y un mensaje público en español.

Con el backend iniciado, consulta sin modificar datos:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/team-members' -Method Get
```

En Swagger abre **Integrantes → GET /team-members → Try it out → Execute**.
Si esperabas integrantes y aparece `[]`, comprueba el archivo SQLite configurado,
las migraciones y la carga `npm run db:seed:members` según la [guía del catálogo](integrantes.md).
Desde la parte 12 las tareas se asignan por `responsibleId`, con un selector en React.
Crear o reasignar exige un integrante activo; editar permite conservar al responsable
inactivo actual. La API comprueba la asignación dentro de la transacción de escritura.

### Crear una tarea

Solo se aceptan `title`, `description`, `responsibleId` y `status`:

```json
{
  "title": "Revisar servidor de pruebas",
  "description": "Comprobar los servicios y registrar el resultado.",
  "status": "PENDIENTE",
  "responsibleId": 1
}
```

El backend recorta espacios al inicio y al final de los campos de texto antes de validar
las longitudes. Rechaza títulos vacíos, de espacios o con el carácter nulo U+0000
(`\u0000` en JSON). Este último caso devuelve `400` con el error asociado a `title`,
sin insertar ni modificar la tarea. La misma regla se aplica al editar.
`responsibleId` debe ser un
entero JSON entre 1 y 2147483647 que corresponda a un integrante activo. Los nombres
libres, objetos y números enviados como texto se rechazan.
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
  "responsible": {
    "id": 1,
    "code": "TI-001",
    "name": "Franco Cabello",
    "isActive": true
  },
  "status": "PENDIENTE",
  "createdAt": "2026-10-08T12:00:00.000Z",
  "updatedAt": "2026-10-08T12:00:00.000Z",
  "responsibleId": 1
}
```

El identificador y las fechas del ejemplo son ilustrativos. Consulta el catálogo para
obtener un `responsibleId` real. La respuesta incluye el objeto público `responsible`,
con el nombre, código y estado actual del integrante.

Con el backend iniciado, puedes probarlo en PowerShell desde otra terminal:

```powershell
$selectedMember = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/team-members' -Method Get | Select-Object -First 1
if ($null -eq $selectedMember) { throw 'Carga primero un integrante activo en el catálogo.' }

$taskBody = @{
    title = 'Revisar servidor de pruebas'
    description = 'Comprobar los servicios y registrar el resultado.'
    responsibleId = $selectedMember.id
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
`description`, `responsibleId` y `status`. Aplica los mismos tipos, estados, longitudes
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
    responsibleId = $selectedMember.id
    status = 'COMPLETADO'
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/tasks/$($createdTask.id)" -Method Put `
    -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($updatedTaskBody))

Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/tasks' -Method Get
```

La respuesta `200` contiene la tarea completa, con el mismo formato de la creación.
Conservar el responsable inactivo actual está permitido; cambiarlo exige uno activo.
Los errores de asignación responden `400` con mensajes en `error.fields.responsibleId`.
La clave foránea impide eliminar un integrante que todavía tenga tareas.

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
Al editar, la asignación actual se consulta dentro de la misma transacción que
valida al integrante y escribe los cambios. Al eliminar, se opera directamente sobre
el identificador; no se consulta previamente fuera de una transacción.

### CORS

La API responde con permisos CORS únicamente cuando `Origin` coincide con
`FRONTEND_ORIGIN`. Las solicitudes preflight del navegador se atienden automáticamente.
Los métodos permitidos son `GET`, `POST`, `PUT` y `DELETE`.
Las herramientas sin `Origin`, como Postman o los scripts, pueden utilizar la API.
CORS controla el acceso a las respuestas desde el navegador; no sustituye autenticación.

## OpenAPI y Swagger UI

La especificación explícita está en `backend/docs/openapi.yaml`, con OpenAPI 3.0.3.
Incluye las cuatro operaciones CRUD, la consulta de integrantes activos, el endpoint de salud, los parámetros de ruta,
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

1. Consulta **GET /team-members** y utiliza uno de sus identificadores como `responsibleId`.
   Abre **POST /tasks**, pulsa **Try it out**, revisa el JSON de ejemplo y pulsa **Execute**.
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
npm run test:members:api
```

`docs:validate` comprueba la estructura OpenAPI y las referencias internas. No necesita
iniciar el backend ni configurar una base de datos. `test:docs` comprueba los ejemplos
y esquemas de entrada. Las pruebas HTTP verifican la publicación del contrato, la página
y los recursos de Swagger, y contrastan respuestas reales del CRUD con los esquemas
documentados, incluidos los errores y el `204` sin cuerpo.

Si cambias rutas, campos, reglas o respuestas, actualiza el YAML y ejecuta `npm run check`.
Swagger documenta y permite probar la API; la validación de las solicitudes sigue siendo
responsabilidad de Zod y de las restricciones de la base.
