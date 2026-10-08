# Gestión de tareas del equipo de TI

Aplicación web para crear, consultar, editar y eliminar tareas. Cada tarea tiene
título, descripción opcional, responsable y estado: **Pendiente**, **En Proceso** o
**Completado**. Incluye validaciones, confirmación de eliminación, persistencia local,
documentación interactiva de la API y pruebas automatizadas. No requiere login.

## Requisitos

- **Node.js 24.21.0**, indicado en `.nvmrc`. Instálalo desde [Node.js](https://nodejs.org/en/download).
- **npm 11 o superior**. La verificación local usa npm 11.19.0.
- **Git**, para clonar el repositorio.
- Conexión a Internet durante la clonación y la instalación de dependencias.

Comprueba las herramientas en una terminal nueva:

```bash
node --version
npm --version
git --version
```

Node debe mostrar `v24.21.0`. Si utilizas un administrador de versiones, selecciona
la versión de `.nvmrc`. No necesitas instalar Prisma globalmente, Docker ni un servidor
de base de datos: **SQLite guarda los datos en un archivo de tu computadora**.

## Ejecutar desde cero

Sigue los pasos en orden. Ejecuta todos los comandos desde la **raíz del proyecto**,
donde está el `package.json` que contiene `workspaces`, junto a `frontend` y `backend`.
Si un paso devuelve un error, resuélvelo antes de continuar.

### 1. Clonar y entrar al proyecto

```bash
git clone https://github.com/FrancoCabelloDev/prueba_tec_Kayser.git gestion-tareas-ti
cd gestion-tareas-ti
```

Si ya tienes el repositorio descargado, abre una terminal en su carpeta raíz y omite
la clonación. La carpeta de destino del ejemplo debe estar libre.

### 2. Instalar dependencias

```bash
npm ci
```

Una sola instalación incluye frontend y backend. Se utilizan las versiones de
`package-lock.json`; no instales dependencias por separado dentro de cada carpeta.
[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) exige que el lockfile coincida
con los manifiestos y no lo reescribe.

### 3. Crear los archivos de configuración local

**Windows — PowerShell:**

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

**Linux o macOS — Bash:**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Estos comandos son para la primera instalación. **Si ya existen los `.env`, conserva
su contenido y revisa los valores**. Los ejemplos permiten ejecutar ambos proyectos
en la misma computadora sin editar ninguna variable:

| Archivo         | Variable          | Valor inicial               | Para qué sirve                        |
| --------------- | ----------------- | --------------------------- | ------------------------------------- |
| `backend/.env`  | `NODE_ENV`        | `development`               | Entorno del backend                   |
| `backend/.env`  | `PORT`            | `3000`                      | Puerto del backend                    |
| `backend/.env`  | `FRONTEND_ORIGIN` | `http://127.0.0.1:5173`     | Origen de React permitido por CORS    |
| `backend/.env`  | `DATABASE_URL`    | `file:./prisma/dev.db`      | Archivo SQLite, relativo a `backend`  |
| `frontend/.env` | `VITE_API_URL`    | `http://127.0.0.1:3000/api` | Dirección de la API que consume React |

Los `.env` no se publican en Git. `VITE_API_URL` es pública porque se incluye en el
frontend. Las variables definidas en la terminal tienen prioridad sobre los archivos;
utiliza una terminal nueva si vienes de otra configuración.

### 4. Generar Prisma y crear la base de datos

```bash
npm run db:generate
npm run db:migrate
npm run db:status
```

- `db:generate` crea el cliente Prisma que necesita el backend.
- `db:migrate` crea el archivo SQLite y aplica las migraciones versionadas.
- `db:status` debe indicar que las migraciones están al día.

Con la configuración inicial, se crea **`backend/prisma/dev.db`**. La primera
instalación deja la tabla de tareas vacía. Volver a aplicar las migraciones no borra
las tareas ni repite las migraciones ya aplicadas.

**Opcional:** para cargar tres tareas de ejemplo, una por estado:

```bash
npm run db:seed
```

El seed solo inserta ejemplos cuando la tabla está vacía. Si contiene tareas, conserva
los datos existentes. No es necesario ejecutarlo para usar la aplicación.

### 5. Iniciar frontend y backend

```bash
npm run dev
```

Deja esa terminal abierta mientras utilizas la aplicación. Debes ver el mensaje de
la API disponible y la dirección local de Vite. Abre estas direcciones:

| Servicio          | Dirección predeterminada                                                         | Resultado esperado                         |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| Aplicación React  | [http://127.0.0.1:5173](http://127.0.0.1:5173)                                   | Listado de tareas o mensaje de lista vacía |
| Salud del backend | [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health)             | `{"status":"ok"}`                          |
| Swagger UI        | [http://127.0.0.1:3000/api/docs/](http://127.0.0.1:3000/api/docs/)               | Documentación interactiva de la API        |
| Contrato OpenAPI  | [http://127.0.0.1:3000/api/openapi.json](http://127.0.0.1:3000/api/openapi.json) | Especificación en JSON                     |

Usa `127.0.0.1` de forma consistente: `localhost` es un origen distinto para CORS.
Los puertos 3000 y 5173 deben estar disponibles. Para detener ambos proyectos, pulsa
**Ctrl+C**. Los datos permanecen guardados al cerrar y volver a iniciar.

Para abrir el proyecto después de la primera instalación, basta con ejecutar
`npm run dev` desde la raíz. No vuelvas a copiar los `.env` ni a cargar ejemplos.
Si descargaste cambios con nuevas migraciones, ejecuta antes `npm run db:migrate`.

### Iniciar en dos terminales

Útil para reiniciar solamente el backend. Ambas terminales deben estar en la raíz.
Utiliza esta alternativa en lugar del comando conjunto:

```bash
# Terminal 1
npm run dev:backend
```

```bash
# Terminal 2
npm run dev:frontend
```

El comando conjunto detiene ambos procesos cuando uno termina. Para comprobar errores
de conexión o reiniciar únicamente la API, usa las terminales separadas.

## Comprobar que funciona

1. Pulsa **Nueva tarea**, completa título y responsable, selecciona un estado y guarda.
2. Recarga el navegador: la tarea debe permanecer guardada.
3. Pulsa **Editar**, revisa los datos precargados, cambia el responsable o estado y guarda.
4. Reinicia el backend y pulsa **Actualizar**: los cambios deben permanecer.
5. Pulsa **Eliminar**, revisa el título y confirma; la tarea debe desaparecer.

Título, responsable y estado son obligatorios. Los textos que contienen solo espacios
no son válidos. Los límites son 150 caracteres para título, 100 para responsable y
2.000 para descripción. La eliminación es **física y definitiva**; utiliza una tarea
de prueba propia para este recorrido. [Recorrido completo y cobertura](docs/verificacion.md).

## API y Swagger

| Método | Ruta             | Respuesta exitosa          |
| ------ | ---------------- | -------------------------- |
| GET    | `/api/health`    | `200`, estado del servidor |
| GET    | `/api/tasks`     | `200`, lista de tareas     |
| POST   | `/api/tasks`     | `201`, tarea creada        |
| PUT    | `/api/tasks/:id` | `200`, tarea editada       |
| DELETE | `/api/tasks/:id` | `204`, sin cuerpo          |

En Swagger, abre una operación, pulsa **Try it out**, completa los datos y pulsa
**Execute**. Las escrituras se realizan sobre la misma base que utiliza React.
La API recibe `PENDIENTE`, `EN_PROCESO` y `COMPLETADO`; React muestra sus etiquetas
en español. PUT exige los cuatro campos editables, incluso `description`, que admite
`null`. [Ejemplos, reglas y errores HTTP](docs/api.md).

## Pruebas y calidad

Después de instalar y configurar los `.env`, ejecuta desde la raíz:

```bash
npm run check
```

Comprueba lint, formato, OpenAPI, tipos, compilación y todas las pruebas. No necesita
los servidores iniciados. Las pruebas del backend utilizan bases temporales aisladas
y no modifican tu `dev.db`. Las de React simulan respuestas HTTP.

| Comando                    | Función                                              |
| -------------------------- | ---------------------------------------------------- |
| `npm test`                 | Todas las pruebas de frontend y backend              |
| `npm run test:frontend`    | Listado, formularios, errores y eliminación en React |
| `npm run test:api`         | CRUD, validaciones, errores, CORS y contrato HTTP    |
| `npm run test:persistence` | Migraciones, restricciones, seed y persistencia      |
| `npm run test:lifecycle`   | CRUD por HTTP con reinicios reales del backend       |
| `npm run test:docs`        | Ejemplos y esquemas OpenAPI                          |
| `npm run docs:validate`    | Estructura y referencias de OpenAPI                  |
| `npm run lint`             | Reglas de ESLint                                     |
| `npm run typecheck`        | Tipos de frontend y backend; genera Prisma           |
| `npm run format:check`     | Formato, sin modificar archivos                      |
| `npm run format`           | Aplicar formato                                      |
| `npm run build`            | Comprobar tipos y compilar ambos proyectos           |

GitHub Actions ejecuta los controles en Windows y Ubuntu en cada push o pull request.
El workflow está en `.github/workflows/ci.yml`. [Cómo revisar CI](docs/verificacion.md#github-actions).

## Comprobar la compilación local

```bash
npm run build
```

Para servir la compilación, cambia **temporalmente** `FRONTEND_ORIGIN` en `backend/.env`
a `http://127.0.0.1:4173`. Detén los servidores anteriores e inicia en dos terminales:

```bash
# Terminal 1
npm run start:backend
```

```bash
# Terminal 2
npm run preview:frontend
```

Abre [http://127.0.0.1:4173](http://127.0.0.1:4173). Al volver a `npm run dev`, restaura
`FRONTEND_ORIGIN=http://127.0.0.1:5173` y reinicia el backend. El frontend compilado
incorpora `VITE_API_URL`: si la cambias, vuelve a compilar. Conserva
`backend/docs/openapi.yaml` junto al backend. Esta vista previa sirve para comprobar
la compilación en local; el proyecto no incluye un despliegue de producción.

## Tecnologías y organización

- **Frontend:** React, TypeScript, Vite, React Hook Form y Zod.
- **Backend:** Node.js, Express, TypeScript, Prisma y SQLite.
- **Documentación:** OpenAPI 3.0.3 y Swagger UI.
- **Calidad:** ESLint, Prettier, Vitest, React Testing Library, Supertest y GitHub Actions.
- **Repositorio:** npm workspaces y un único `package-lock.json` con versiones fijadas.

```text
frontend/              Interfaz React y pruebas
backend/src/           API, validaciones, controladores, servicios y repositorios
backend/prisma/        Modelo, migraciones SQL y seed
backend/docs/          Contrato OpenAPI
backend/tests/         Pruebas HTTP, persistencia y reinicios
docs/                  Guías técnicas, verificación y entrega
.github/workflows/     Integración continua
```

El responsable es un texto libre. `Task` representa una tarea y contiene también
identificador y fechas. Prisma consulta el archivo SQLite local; no aloja la base
en un servidor propio. No se utilizan procedimientos almacenados.

El alcance es un CRUD para una prueba técnica. No incluye autenticación, usuarios,
paginación, filtros, historial ni recuperación de tareas eliminadas. Posibles mejoras:
usuarios y permisos, filtros y paginación, control de ediciones concurrentes y
eliminación lógica si el negocio necesita recuperación.

## Guías adicionales

- [Solución de problemas de instalación y ejecución](docs/solucion-de-problemas.md).
- [Consultar SQLite, DataGrip, Prisma Studio y migraciones](docs/base-de-datos.md).
- [Arquitectura, controladores y comportamiento del frontend](docs/arquitectura.md).
- [API, Swagger y ejemplos de solicitudes](docs/api.md).
- [Pruebas, recorrido manual y GitHub Actions](docs/verificacion.md).
- [Publicación manual, comprobación de entrega y revisión técnica](docs/entrega.md).

Se versionan el código, los ejemplos de entorno, el lockfile y las migraciones.
Los `.env`, archivos SQLite, `node_modules`, cliente Prisma generado, `dist` y
archivos internos de documentación están excluidos de Git. Los commits, el push y
el envío por correo los realiza manualmente el candidato.
