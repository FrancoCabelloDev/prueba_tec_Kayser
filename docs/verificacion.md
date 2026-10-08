# Verificación del proyecto

Ejecuta los comandos desde la raíz. Se requiere Node.js de `.nvmrc`, las dependencias
instaladas y las variables de entorno descritas en el README.

```bash
npm ci
npm run check
```

`check` detiene la ejecución ante el primer fallo. Revisa lint, formato, OpenAPI,
tipos, compilación y todas las pruebas. Las pruebas del backend crean bases SQLite
temporales bajo `backend/.test-data` y las eliminan al terminar. No utilizan `dev.db`.
Las pruebas de React simulan respuestas HTTP para reproducir errores y solicitudes pendientes.

## Cobertura funcional

| Área              | Comando                                       | Qué verifica                                                                                                                                                 |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API HTTP          | `npm run test:api`                            | CRUD, campos obligatorios, espacios, longitudes, estados, identificadores, tareas inexistentes, errores, CORS y respuestas acordes con OpenAPI               |
| Persistencia      | `npm run test:persistence`                    | Migraciones y seed repetibles, restricciones SQL, fechas, campos opcionales, títulos repetidos y lectura desde un proceso nuevo                              |
| Integrantes       | `npm run test:members`                        | 38 casos: códigos únicos, homónimos, validación, CHECK, carga atómica y repetible; actualización desde el esquema anterior conservando tareas e índices      |
| Inicio y reinicio | `npm run test:lifecycle`                      | Servidor Node real: crear, consultar, editar, reiniciar, comprobar cambios, eliminar y volver a reiniciar para verificar que la eliminación persiste         |
| Documentación     | `npm run test:docs` y `npm run docs:validate` | Esquemas, ejemplos, referencias y estructura OpenAPI                                                                                                         |
| Interfaz React    | `npm run test:frontend`                       | Carga, vacío, error, reintento, formulario obligatorio, longitudes, precarga, cancelación, conservación de datos, confirmación y bloqueo durante solicitudes |

La prueba de reinicio inicia `src/server.ts` mediante Node.js y tsx en un proceso separado,
con un puerto libre y una base temporal migrada. Envía peticiones HTTP reales y reinicia
el proceso sobre el mismo archivo SQLite. No necesita un `dist` previo. Esto complementa
las pruebas con Supertest y comprueba la configuración y el arranque del servidor.

## Recorrido manual

Inicia los servidores en terminales separadas para poder reiniciar únicamente el backend:

```bash
npm run dev:frontend
```

```bash
npm run dev:backend
```

1. Abre `http://127.0.0.1:5173` y crea una tarea de prueba con título, descripción,
   responsable y estado Pendiente. Comprueba el mensaje de éxito y la tarjeta.
2. Recarga la página: la tarea debe permanecer con los mismos datos.
3. Edita la tarea, cambia el responsable y selecciona Completado. Guarda y comprueba la tarjeta.
4. Detén el backend con `Ctrl+C` y vuelve a iniciarlo con `npm run dev:backend`.
5. Pulsa Actualizar: los cambios deben permanecer. Abre Swagger en
   `http://127.0.0.1:3000/api/docs/` y consulta GET /tasks para contrastarlos.
6. Pulsa Eliminar y comprueba que la confirmación identifica el título correcto.
   Cancela una vez; la tarea debe seguir existiendo. Confirma después y comprueba su desaparición.
7. Recarga la página y verifica que la tarea eliminada no vuelve a aparecer.
8. Comprueba también errores de validación, navegación con teclado, ancho móvil y
   conservación de valores tras un fallo de guardado según la [guía de arquitectura](arquitectura.md).

Utiliza una tarea de prueba propia: la eliminación es física y las operaciones manuales
modifican la base configurada. Si usas una base temporal para el recorrido, aplica primero
sus migraciones y conserva el mismo `DATABASE_URL` al reiniciar el backend.

## GitHub Actions

El workflow `.github/workflows/ci.yml` se ejecuta en todos los push, en los pull requests
y manualmente mediante `workflow_dispatch`. El job Calidad se ejecuta en Ubuntu y Windows,
sin cancelar el otro sistema si uno falla. Cada ejecución usa un checkout nuevo.

| Paso                         | Propósito                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Obtener el código            | Descargar el commit que se está verificando                                    |
| Configurar Node              | Usar `.nvmrc` y la caché de descargas de npm asociada al lockfile              |
| `npm ci`                     | Instalar las versiones del lockfile; fallar si no coincide con los manifiestos |
| `npm run lint`               | Revisar reglas del código sin modificar archivos                               |
| `npm run format:check`       | Comprobar el formato                                                           |
| `npm run docs:validate`      | Validar el contrato OpenAPI                                                    |
| `npm run typecheck`          | Generar Prisma y revisar los tipos del frontend, backend y pruebas             |
| `npm test`                   | Ejecutar las pruebas de ambos workspaces                                       |
| `npm run build --workspaces` | Compilar React y Node después de comprobar los tipos                           |

Las variables del workflow son valores públicos para validación local del runner; no
requieren secrets. No se copian archivos `.env` ni la base de desarrollo. Los tests generan
y migran sus propias bases. La caché contiene descargas de npm, no `node_modules` ni SQLite.
`NODE_ENV=test` se aplica únicamente al paso de pruebas; la compilación utiliza
`NODE_ENV=production` para generar el frontend de producción.

Las acciones oficiales checkout y setup-node están fijadas a commits completos, con
su versión indicada en comentarios. Para actualizarlas, verifica el nuevo commit en el
repositorio oficial. El token tiene permiso de lectura de contenidos y checkout no
conserva credenciales. El workflow comprueba el proyecto; no publica ni despliega la aplicación.

Las ejecuciones anteriores del mismo evento y rama se cancelan al llegar otro cambio.
Cada job tiene un límite de 20 minutos. La instalación y los pasos posteriores deben
terminar correctamente para que aparezca el resultado verde.

## Revisar el resultado después del push manual

1. Publica los cambios manualmente siguiendo la [guía de entrega](entrega.md).
2. Abre tu repositorio en GitHub y selecciona **Actions**.
3. Abre la ejecución **CI** que corresponde al commit que acabas de publicar.
4. Comprueba que **Calidad (ubuntu-latest)** y **Calidad (windows-latest)** terminaron en verde.
5. Si aparece un fallo, abre ese job y el primer paso rojo; revisa el log, corrige la causa,
   ejecuta `npm run check` localmente y publica un nuevo commit.

También puedes entrar en Actions → CI → Run workflow para repetir una comprobación.
La ejecución real en GitHub se confirma después del push. Una comprobación local exitosa
no demuestra por sí sola que ambos runners remotos hayan finalizado correctamente.

## Comprobación final de instalación desde cero

El 8 de octubre de 2026 se verificó la entrega en Windows con Node.js 24.21.0 y npm
11.19.0. Se clonó GitHub en una carpeta distinta usando el commit `98c1832` de la
parte 8 y se aplicaron localmente las guías finales de la parte 9 antes de publicarlas.
El clon llegó sin dependencias, `.env`, SQLite, cliente Prisma generado ni compilaciones.

Resultados comprobados:

- `npm ci`: instalación correcta desde el lockfile.
- Copia de `.env.example`, generación de Prisma, migraciones y `db:status`: correctos.
- `npm run check`: lint, formato, OpenAPI, tipos, compilación y **198 pruebas aprobadas**.
- React: creación, recarga, edición, reinicio del backend, consulta, eliminación y recarga correctos.
- La tarea editada permaneció en el archivo SQLite nuevo después del reinicio.
- Salud y Swagger accesibles; frontend y backend compilados ejecutados correctamente.
- `npm run db:seed`: tres ejemplos insertados en la tabla vacía del clon.

La instalación habitual del candidato ocupaba 3000 y 5173, por lo que el clon utilizó
3001 y 5174 siguiendo la guía de puertos alternativos. La vista previa se verificó en
4173 con el origen CORS correspondiente. Los servidores y la base de la instalación
habitual no se modificaron. Esta comprobación local no sustituye revisar CI para el
commit final que el candidato publique.

## Comprobación de la parte 10

El 8 de octubre de 2026, en Windows con Node.js 24.21.0 y npm 11.19.0:

- `npm run check`: lint, formato, OpenAPI, tipos y compilación correctos; **236 pruebas
  aprobadas** (42 de frontend y 194 de backend, incluidas las 38 nuevas del catálogo).
- `prisma validate`: esquema válido.
- Las pruebas del catálogo comprobaron una instalación vacía y la actualización
  desde la migración anterior, conservando las tareas y sus restricciones.
- Antes de actualizar la base local, se creó un respaldo mediante la API de backup
  de SQLite en `.document_work/part10-respaldo-antes-de-migrar.db`, excluido de Git.
- Se aplicó la migración y se cargaron TI-001 — Franco Cabello y TI-002 — Oscar Perez.
- Una comparación antes/después confirmó que la tarea local, la definición SQL de
  `Task`, sus índices y su secuencia autoincremental permanecieron iguales.
- `PRAGMA integrity_check` devolvió `ok`.

Esta verificación corresponde al avance local. CI se comprobará después del push manual.
