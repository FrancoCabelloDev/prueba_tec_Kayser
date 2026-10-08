# Gestión de tareas del equipo de TI

Aplicación con React y Node.js para registrar, consultar, editar y eliminar tareas.
Cada tarea tendrá título, descripción, responsable y uno de estos estados: Pendiente,
En Proceso o Completado.

## Avance actual

Las partes 1 y 2 del plan están implementadas: frontend y backend con TypeScript,
npm workspaces, ESLint, Prettier y persistencia de tareas con Prisma y SQLite.
El frontend presenta la pantalla inicial. El backend verifica la conexión y las tablas
al arrancar y ofrece un endpoint de salud.

La base incluye una migración versionada, restricciones de datos, un seed opcional y
pruebas de persistencia. Los endpoints del CRUD, Swagger y GitHub Actions se agregarán
en los siguientes avances. La pantalla inicial todavía no consulta ni administra tareas.

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
| `backend/.env`  | `FRONTEND_ORIGIN` | `http://127.0.0.1:5173`     | Origen reservado para configurar CORS en la parte 3             |
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
forma estable. Las validaciones y el control de campos editables en HTTP se incorporarán
en las partes 3 y 4.

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

## Comandos de calidad y compilación

| Comando desde la raíz      | Función                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run lint`             | Verifica reglas de ESLint sin modificar archivos                    |
| `npm run typecheck`        | Comprueba tipos del frontend y backend                              |
| `npm run format:check`     | Verifica el formato sin modificar archivos                          |
| `npm run format`           | Aplica el formato de Prettier                                       |
| `npm run build`            | Comprueba tipos y compila ambos proyectos                           |
| `npm run test:persistence` | Verifica migraciones, restricciones, seed y persistencia            |
| `npm run check`            | Ejecuta lint, formato, tipos, compilación y pruebas de persistencia |

Las pruebas usan una base temporal aislada bajo `backend/.test-data`, que se elimina
al finalizar. No utilizan ni modifican `dev.db`. Verifican la instalación desde un archivo
inexistente, la repetición segura de migraciones y seed, los campos obligatorios,
los estados y longitudes inválidos, títulos repetidos, fechas y lectura desde un proceso nuevo.

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
    lib/prisma.ts     Cliente Prisma de la aplicación
    generated/prisma/ Cliente generado localmente
    app.ts            Configuración de Express y endpoint de salud
    server.ts         Inicio y cierre del servidor
  prisma/
    schema.prisma     Modelo de tareas y estados
    migrations/       SQL versionado con restricciones
    ensure-database.ts Preparación del archivo SQLite
    seed.ts           Datos de ejemplo opcionales
  tests/              Pruebas de persistencia
  prisma.config.ts    Configuración de la CLI y las migraciones
eslint.config.js      Reglas de JavaScript, TypeScript y React
tsconfig.base.json    Opciones compartidas de TypeScript
```

`app.ts` no abre un puerto ni depende de la configuración de inicio. Esta separación
permitirá probar la API en las siguientes etapas.

Prisma, su cliente y el adaptador SQLite están fijados en la misma versión estable 7.10.0.
El repositorio incluye overrides acotados para `deepmerge-ts` y `mysql2`, dependencias
indirectas de la CLI, con versiones corregidas de sus avisos de seguridad. No implican
el uso de MySQL por la aplicación. La generación, las migraciones y las pruebas verifican
la compatibilidad de esos ajustes.

## Commit y push manuales de la parte 2

Los commits y push los realiza el candidato. Git ya está inicializado; no es necesario
volver a ejecutar `git init`. Antes de publicar:

```bash
npm run check
git status
git diff
git add README.md package.json package-lock.json eslint.config.js .gitignore .prettierignore backend
git diff --cached
git commit -m "feat: agregar persistencia de tareas con Prisma y SQLite"
git push
```

Si la rama aún no tiene seguimiento remoto, utiliza `git push -u origin main` en lugar
de `git push`, después de configurar el remoto de tu repositorio.

El momento de publicar es después de comprobar el arranque y ejecutar las verificaciones.
No incluyas `.env`, `node_modules`, `dist`, el cliente generado, bases locales ni los archivos internos de
generación de documentos. Los archivos originales del Word se conservan localmente.
