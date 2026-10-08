# Gestión de tareas del equipo de TI

Aplicación con React y Node.js para registrar, consultar, editar y eliminar tareas.
Cada tarea tendrá título, descripción, responsable y uno de estos estados: Pendiente,
En Proceso o Completado.

## Avance actual

Las partes 1, 2 y 3 del plan están implementadas: frontend y backend con TypeScript,
npm workspaces, ESLint, Prettier, persistencia con Prisma y SQLite y una API para
listar y crear tareas. El frontend presenta la pantalla inicial. El backend verifica
la conexión y las tablas al arrancar y ofrece un endpoint de salud.

La API incluye validaciones con Zod, CORS para el origen del frontend, manejo centralizado
de errores y pruebas de integración sobre una base temporal. La base incluye una
migración versionada, restricciones de datos, un seed opcional y pruebas de persistencia.
La edición, la eliminación, Swagger y GitHub Actions se agregarán en los siguientes avances.
La pantalla inicial todavía no consulta ni administra tareas.

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
debe proporcionarse al crear una tarea. La selección inicial Pendiente se incorporará
al formulario en su etapa correspondiente.

SQLite guarda los estados como texto. La migración agrega un `CHECK` para impedir
estados inválidos incluso mediante SQL directo, además de restricciones de campos
obligatorios y longitud. El índice de `createdAt` e `id` permite ordenar las tareas de
forma estable. La API valida los campos al crear tareas y rechaza propiedades adicionales.
El control de los campos de edición se incorporará en la parte 4.

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

## API disponible en la parte 3

URL base de ejemplo: `http://127.0.0.1:3000/api`. Las solicitudes de creación deben
enviar `Content-Type: application/json`. No se requiere autenticación.

| Método | Ruta          | Resultado                                                   |
| ------ | ------------- | ----------------------------------------------------------- |
| GET    | `/api/health` | `200` con `{ "status": "ok" }`                              |
| GET    | `/api/tasks`  | `200` con un arreglo de tareas; `[]` si la tabla está vacía |
| POST   | `/api/tasks`  | `201` con la tarea creada y persistida                      |

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

Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/tasks' -Method Post `
    -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($taskBody))

Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/tasks' -Method Get
```

La solicitud POST del ejemplo agrega una tarea a tu base local. También puedes utilizar
Postman con el cuerpo JSON indicado. Swagger se incorporará en la parte 5.

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

| HTTP | Código                 | Causa                                             |
| ---- | ---------------------- | ------------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | Campos ausentes, inválidos o adicionales          |
| 400  | `INVALID_JSON`         | JSON mal formado o un valor JSON primitivo        |
| 404  | `ROUTE_NOT_FOUND`      | Ruta o combinación de ruta y método inexistente   |
| 413  | `PAYLOAD_TOO_LARGE`    | Cuerpo superior al límite de 16 KB                |
| 415  | `UNSUPPORTED_ENCODING` | Charset o codificación de contenido no soportados |
| 500  | `INTERNAL_ERROR`       | Fallo inesperado al procesar la solicitud         |

Los errores inesperados se registran en la consola del backend. La respuesta pública
omite detalles de Prisma, SQL y trazas internas. Las validaciones fallidas no escriben
en la base de datos.

### CORS

La API responde con permisos CORS únicamente cuando `Origin` coincide con
`FRONTEND_ORIGIN`. Las solicitudes preflight del navegador se atienden automáticamente.
Las herramientas sin `Origin`, como Postman o los scripts, pueden utilizar la API.
CORS controla el acceso a las respuestas desde el navegador; no sustituye autenticación.

## Comandos de calidad y compilación

| Comando desde la raíz      | Función                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `npm run lint`             | Verifica reglas de ESLint sin modificar archivos                  |
| `npm run typecheck`        | Comprueba tipos del frontend y backend                            |
| `npm run format:check`     | Verifica el formato sin modificar archivos                        |
| `npm run format`           | Aplica el formato de Prettier                                     |
| `npm run build`            | Comprueba tipos y compila ambos proyectos                         |
| `npm run test:persistence` | Verifica migraciones, restricciones, seed y persistencia          |
| `npm run test:api`         | Verifica listado, creación, validaciones, errores y CORS por HTTP |
| `npm test`                 | Ejecuta todas las pruebas del backend                             |
| `npm run check`            | Ejecuta lint, formato, tipos, compilación y todas las pruebas     |

Las pruebas usan una base temporal aislada bajo `backend/.test-data`, que se elimina
al finalizar. No utilizan ni modifican `dev.db`. Verifican la instalación desde un archivo
inexistente, la repetición segura de migraciones y seed, los campos obligatorios,
los estados y longitudes inválidos, títulos repetidos, fechas y lectura desde un proceso nuevo.
Las pruebas HTTP usan Supertest con Express y SQLite real para comprobar las respuestas
y los datos guardados. Solo los fallos internos se simulan para verificar la respuesta `500`.

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
    App.tsx           Pantalla inicial
    main.tsx          Entrada de React
    styles.css        Estilos básicos
  vite.config.ts      Servidor y compilación
backend/
  src/
    config/           Lectura de entorno y ruta compartida de la base
    errors/           Error HTTP con código, mensaje y campos opcionales
    middlewares/      Validación del cuerpo, rutas inexistentes y errores
    modules/tasks/
      task.routes.ts      Rutas GET y POST
      task.controller.ts  Controladores: solicitudes y respuestas HTTP
      task.service.ts     Reglas de creación y campos admitidos
      task.repository.ts  Consultas y escritura con Prisma
      task.schema.ts      Validaciones Zod y tipo de entrada
    lib/prisma.ts     Cliente Prisma de la aplicación
    generated/prisma/ Cliente generado localmente
    app.ts            Construcción de Express, CORS, rutas y middlewares
    server.ts         Inicio y cierre del servidor
  prisma/
    schema.prisma     Modelo de tareas y estados
    migrations/       SQL versionado con restricciones
    ensure-database.ts Preparación del archivo SQLite
    seed.ts           Datos de ejemplo opcionales
  tests/              Pruebas de persistencia e integración de la API
  prisma.config.ts    Configuración de la CLI y las migraciones
eslint.config.js      Reglas de JavaScript, TypeScript y React
tsconfig.base.json    Opciones compartidas de TypeScript
```

`app.ts` exporta `createApp(frontendOrigin)` y no abre un puerto. `server.ts` valida el
entorno, verifica la base y comienza a escuchar. Las pruebas configuran una base temporal
antes de importar la aplicación, sin iniciar el servidor de desarrollo.

El flujo de una creación es: ruta → validación → controlador → servicio → repositorio →
Prisma/SQLite. El controlador devuelve el resultado HTTP; el servicio normaliza la
descripción y selecciona los campos; el repositorio concentra el acceso a datos.
Express 5 dirige los errores de las funciones asíncronas al middleware central.

Prisma, su cliente y el adaptador SQLite están fijados en la misma versión estable 7.10.0.
El repositorio incluye overrides acotados para `deepmerge-ts` y `mysql2`, dependencias
indirectas de la CLI, con versiones corregidas de sus avisos de seguridad. No implican
el uso de MySQL por la aplicación. La generación, las migraciones y las pruebas verifican
la compatibilidad de esos ajustes.

## Commit y push manuales de la parte 3

Los commits y push los realiza el candidato. Git ya está inicializado; no es necesario
volver a ejecutar `git init`. Antes de publicar:

```bash
npm run check
git status
git diff
git add README.md package.json package-lock.json backend
git diff --cached
git commit -m "feat: implementar listado y creación de tareas con validaciones"
git push
```

Si la rama aún no tiene seguimiento remoto, utiliza `git push -u origin main` en lugar
de `git push`, después de configurar el remoto de tu repositorio.

El momento de publicar es después de comprobar el arranque y ejecutar las verificaciones.
No incluyas `.env`, `node_modules`, `dist`, el cliente generado, bases locales ni los archivos internos de
generación de documentos. Los archivos originales del Word se conservan localmente.
