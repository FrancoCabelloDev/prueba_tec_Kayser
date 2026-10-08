# Solución de problemas

[Volver al README](../README.md). Ejecuta los comandos desde la raíz salvo que se
indique otra carpeta. Resuelve el primer error antes de continuar con los siguientes pasos.

## Herramientas o dependencias

| Mensaje o síntoma                                                             | Qué revisar y cómo resolverlo                                                                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node`, `npm` o `git` no se reconoce                                          | Instala la herramienta correspondiente y abre una terminal nueva. Verifica `node --version`, `npm --version` y `git --version`.                         |
| `npm.ps1` no se puede ejecutar por la política de PowerShell                  | Usa `npm.cmd` en lugar de `npm`, o ejecuta los comandos en una terminal CMD. Para `npx`, usa `npx.cmd`. No necesitas cambiar la política de PowerShell. |
| `ENOENT` al buscar `package.json`, o script no encontrado                     | Abre la raíz del repositorio: debe contener `frontend`, `backend` y el `package.json` con `workspaces`.                                                 |
| Node incompatible, `EBADENGINE` o módulo nativo `better-sqlite3` incompatible | Selecciona Node 24.21.0, detén los servidores del proyecto y vuelve a ejecutar `npm ci` desde la raíz. La instalación debe finalizar correctamente.     |
| `npm ci` falla por diferencias con `package-lock.json`                        | Comprueba que descargaste los manifiestos y el lockfile del mismo commit. No borres el lockfile ni uses versiones distintas para ocultar el error.      |
| Fallo de descarga, conexión o certificado durante `npm ci`                    | Revisa Internet y la configuración de proxy o certificados de tu red. Reintenta cuando la conexión esté disponible; conserva las verificaciones TLS.    |
| `Cannot find module` o cliente Prisma sin generar                             | Completa `npm ci`, configura `backend/.env` y ejecuta `npm run db:generate`.                                                                            |
| Archivo bloqueado o `EPERM` durante la instalación                            | Detén los servidores que ejecutan esta copia del proyecto. Cierra herramientas que bloqueen ese archivo y reintenta `npm ci`.                           |

## Variables o base de datos

| Mensaje o síntoma                                                           | Qué revisar y cómo resolverlo                                                                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuración de backend o frontend inválida                                | Comprueba `backend/.env` y `frontend/.env` contra los ejemplos. Los nombres deben ser exactos. En Windows, verifica que el archivo no se llame `.env.txt`. |
| `DATABASE_URL` inválida                                                     | Usa `file:./prisma/dev.db` en `backend/.env`. Esta ruta se interpreta desde `backend`. No uses la URL especial de Studio para configurar la aplicación.    |
| No se pudo abrir la base, tabla `Task` inexistente o migraciones pendientes | Ejecuta `npm run db:generate`, `npm run db:migrate` y `npm run db:status`, en ese orden.                                                                   |
| Error de Prisma con archivo SQLite inexistente                              | Usa `npm run db:migrate`. El script del proyecto prepara el archivo antes de aplicar las migraciones; ejecutar la CLI directamente omite ese paso.         |
| Base bloqueada (`database is locked`)                                       | Termina o revierte las transacciones abiertas en DataGrip u otro editor SQLite y vuelve a intentar. No borres la base.                                     |
| El seed no agregó ejemplos                                                  | Es el comportamiento esperado si ya existe una tarea: solo inserta ejemplos en una tabla vacía.                                                            |
| No veo una tarea en DataGrip o Studio                                       | Comprueba que abriste el archivo indicado por `DATABASE_URL`, consulta `Task` y actualiza la vista. Otra copia del repositorio tiene otra base local.      |

Las variables que ya estén definidas en tu terminal pueden sobrescribir los valores
de los `.env`. Para usar los ejemplos, abre una terminal nueva sin variables de otros
proyectos. No ejecutes `migrate reset` ni borres `dev.db` para solucionar la instalación:
esas acciones podrían eliminar tus tareas.

## Puertos ocupados

Primero comprueba si ya tienes otra terminal ejecutando esta aplicación. Puedes
utilizar esa instancia o detenerla con **Ctrl+C** en su propia terminal.

Si necesitas ejecutar otra copia en paralelo, utiliza esta configuración en esa copia:

**`backend/.env`:**

```dotenv
NODE_ENV=development
PORT=3001
FRONTEND_ORIGIN=http://127.0.0.1:5174
DATABASE_URL=file:./prisma/dev.db
```

**`frontend/.env`:**

```dotenv
VITE_API_URL=http://127.0.0.1:3001/api
```

Inicia desde la raíz, en terminales separadas:

```bash
# Terminal 1
npm run dev:backend
```

```bash
# Terminal 2: el argumento --port se pasa a Vite
npm run dev --workspace frontend -- --port 5174
```

Abre `http://127.0.0.1:5174` y Swagger en `http://127.0.0.1:3001/api/docs/`.
Los puertos alternativos también deben estar libres. `npm run dev` utiliza el puerto
5173 del frontend; para esta configuración utiliza los dos comandos anteriores.

## React no puede consultar o guardar tareas

1. Abre `http://127.0.0.1:3000/api/health`, o el puerto que configuraste. Debe responder
   `{"status":"ok"}`. Si no responde, revisa la terminal del backend.
2. Comprueba que `frontend/.env` tenga la URL correcta, **incluido `/api`**.
3. Comprueba que `FRONTEND_ORIGIN` coincida exactamente con la dirección de React:
   protocolo, host y puerto, sin ruta ni barra final.
4. Usa `127.0.0.1` en todas las direcciones. `localhost` no coincide con ese origen.
5. Reinicia los procesos después de modificar los `.env` y pulsa **Reintentar** o
   **Actualizar**. Una vista previa compilada necesita volver a compilar si cambia `VITE_API_URL`.

Si la API devuelve `400`, revisa los mensajes del formulario o la respuesta de Swagger.
PUT necesita `title`, `description`, `responsibleId` y `status`; una descripción vacía
puede enviarse como `null`. Los estados de la API son `PENDIENTE`, `EN_PROCESO` y `COMPLETADO`.

Para comprobar la compilación en el puerto 4173, usa ese origen en `FRONTEND_ORIGIN`;
restaura 5173 antes de regresar al servidor de desarrollo.

## Prisma Studio

Si aparece `Prisma Studio is not supported for the ... protocol`, usa el comando
con `--url` de la [guía de base de datos](base-de-datos.md#prisma-studio).
La URL se proporciona solo a Studio; conserva `DATABASE_URL=file:./prisma/dev.db`
en el backend. Si utilizas otra ruta SQLite, abre ese archivo en DataGrip o adapta
la ruta de Studio a tu configuración.

## GitHub Actions

Abre el trabajo que falló y revisa su **primer paso rojo**. Reproduce el problema
con `npm run check` y utiliza la misma versión de Node de `.nvmrc`. Corrige la causa
y publica el nuevo commit manualmente. [Guía de CI](verificacion.md#github-actions).
