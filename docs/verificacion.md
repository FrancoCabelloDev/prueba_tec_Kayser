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

| Área              | Comando                                       | Qué verifica                                                                                                                                                            |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API HTTP          | `npm run test:api`                            | CRUD, validación, CORS, OpenAPI, bajas posteriores a consultar el catálogo, homónimos, excepción de inactividad por tarea y eliminación sin efectos en otras filas      |
| Persistencia      | `npm run test:persistence`                    | Migraciones y seed repetibles, restricciones SQL, fechas, campos opcionales, títulos repetidos y lectura desde un proceso nuevo                                         |
| Integrantes       | `npm run test:members`                        | 38 casos: códigos únicos, homónimos, validación, CHECK, carga atómica y repetible; actualización desde el esquema anterior conservando tareas e índices                 |
| Inicio y reinicio | `npm run test:lifecycle`                      | Servidor Node real: CRUD y reinicio con relaciones; actualización desde dos migraciones anteriores, tareas históricas, fechas y secuencia conservadas                   |
| Documentación     | `npm run test:docs` y `npm run docs:validate` | Esquemas, ejemplos, referencias y estructura OpenAPI                                                                                                                    |
| Interfaz React    | `npm run test:frontend`                       | Formularios, carga lenta, catálogo inválido/vacío, reintento, homónimos, respuestas tardías después del cierre y errores de asignación con conservación de datos y foco |

La prueba de reinicio inicia `src/server.ts` mediante Node.js y tsx en un proceso separado,
con un puerto libre y una base temporal migrada. Envía peticiones HTTP reales y reinicia
el proceso sobre el mismo archivo SQLite. No necesita un `dist` previo. Esto complementa
las pruebas con Supertest y comprueba la configuración y el arranque del servidor.
La actualización crea su historial anterior con Prisma, conserva tareas de texto,
aplica la migración de asignaciones y repite migración y seed antes de iniciar el backend.
El catálogo activo excluye al integrante histórico inactivo, pero GET /tasks conserva
su relación. Reiniciar mantiene los datos completos y el siguiente identificador correcto.

## Recorrido manual

Para comprobar el catálogo de la parte 11, ejecuta `npm run test:members:api`.
Sus 12 pruebas HTTP utilizan SQLite temporal y verifican lista vacía, activos e
inactivos, orden por nombre y código, homónimos, DTO público, bajas posteriores,
consulta sin escrituras, error 500, CORS, publicación en Swagger y compatibilidad
con el CRUD de tareas. Están incluidas en `npm test` y `npm run check`.

Con el catálogo cargado, abre Swagger → Integrantes → GET /team-members → Try it out
→ Execute y comprueba la respuesta `200` con los integrantes activos.

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

## Comprobación de la parte 11

El 8 de octubre de 2026 se verificó el avance en Windows con Node.js 24.21.0 y npm
11.19.0:

- `npm run test:members:api`: las 12 nuevas pruebas HTTP aprobaron con SQLite temporal.
- `npm run check`: lint, formato, OpenAPI, tipos y compilación correctos; **248 pruebas
  aprobadas** (42 de frontend y 206 de backend).
- En el backend local, `GET /api/team-members` devolvió los dos integrantes activos
  con únicamente los campos públicos; `/api/health` devolvió `status: ok`.
- Desde Swagger se abrió Integrantes → GET /team-members → Try it out → Execute.
  La respuesta real fue `200`, con Franco Cabello y Oscar Perez.
- La verificación local utilizó únicamente consultas de lectura. Esta parte no
  añade migraciones ni cambia el contrato de tareas; el selector queda para la parte 12.

Los jobs de GitHub Actions se revisarán después del commit y push manuales del candidato.

## Comprobación de la parte 12

El 8 de octubre de 2026, en Windows con Node.js 24.21.0 y npm 11.19.0:

- `npm run check`: lint, formato, OpenAPI, tipos, compilación y **274 pruebas**
  aprobadas (47 de frontend y 227 de backend).
- Migración sobre SQLite vacío y previo, con homónimos, nombres sin equivalencia,
  integrantes inactivos, códigos históricos ocupados y una secuencia con filas eliminadas.
  Se comprobó la reversión de escrituras ante un nombre legado inválido.
- Respaldo SQLite online en `.document_work/part12-respaldo-antes-de-migrar.db`,
  excluido de Git, y prueba de la migración sobre una copia de la base habitual.
- Migración aplicada a la base habitual: la tarea existente conservó identificador,
  título, descripción, estado, fechas y la asignación a Franco Cabello; la secuencia
  de tareas y los integrantes existentes se conservaron. La integridad y las claves
  foráneas se comprobaron sin errores. Las tres migraciones quedaron al día.
- Recorrido de React sobre la copia: creación asignada a Oscar Perez, edición con
  precarga, reasignación a Franco Cabello y actualización del estado.
- Swagger sobre la misma copia: POST con `responsibleId` devolvió `201` y el objeto
  público del integrante. Las tareas de prueba se eliminaron después mediante HTTP,
  conservando la tarea copiada del candidato y su catálogo.

Se utilizaron los puertos 3001 y 5174 para el recorrido de prueba. No se crearon ni
editaron tareas en la base habitual durante ese recorrido. CI se confirmará después
del commit y push manuales. La parte 13 ampliará los escenarios de regresión y la
parte 14 comprobará la entrega final desde una copia limpia.

## Comprobación de la parte 13

El 8 de octubre de 2026, en Windows con Node.js 24.21.0 y npm 11.19.0:

- `npm run check`: lint, formato, OpenAPI, tipos y compilación correctos; **292
  pruebas aprobadas** (57 de frontend y 235 de backend). Son 18 regresiones adicionales.
- `npm run test:api`: 167 pruebas HTTP. Los casos nuevos cubren bajas posteriores
  a consultar el catálogo al crear y editar, homónimos con asignaciones independientes,
  inactividad limitada a la tarea actual, eliminación sin alterar otras filas y
  traducción de errores de referencia sin exponer detalles internos.
- `npm run test:lifecycle`: dos escenarios con procesos reales. La instalación
  nueva conserva la respuesta completa de una tarea reasignada y el catálogo tras
  reiniciar. La actualización aplica la migración publicada sobre una base con
  dos migraciones anteriores y tareas de texto; mantiene identificadores, contenido,
  fechas y relaciones activas e históricas después de repetir comandos y reiniciar.
  Una secuencia anterior de 105 produce correctamente la siguiente tarea con id 106.
- React verifica precarga lenta, catálogos con códigos o identificadores duplicados,
  responsables históricos, reintento tras una baja, conservación de todos los campos,
  foco y cancelación al cerrar. Una respuesta tardía de un formulario cerrado no
  sustituye el catálogo de otro recién abierto. El cliente rechaza relaciones
  incoherentes y admite consultar las relaciones históricas inactivas.
- Recorrido real en React con `.document_work/part13-verificacion.db`, una base
  separada y excluida de Git: se seleccionó Oscar Perez y se desactivó únicamente
  en esa base después de cargar el formulario. El guardado mostró el error de
  asignación, conservó título, descripción, responsable y estado, y enfocó el selector.
  Elegir Franco Cabello permitió guardar. Después se eliminó la tarea de prueba y
  se restauró el catálogo temporal. La evidencia local quedó en
  `.document_work/part13-error-asignacion-verificado.png`, excluida de Git.

El recorrido utilizó 3001 y 5174; los dos servidores temporales se detuvieron al
terminar. Esta parte no modifica la base habitual ni añade migraciones o dependencias.
Las pruebas forman parte de los comandos existentes y CI las ejecutará sin cambiar
el workflow. El resultado remoto se confirmará después del commit y push manuales.
La parte 14 sigue pendiente para consolidar las instrucciones y verificar la entrega limpia.
