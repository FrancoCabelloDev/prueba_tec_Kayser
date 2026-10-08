# Arquitectura y decisiones técnicas

[Volver al README](../README.md).

## Decisiones de alcance

React separa la interfaz de la API Express. TypeScript ayuda a detectar inconsistencias
entre módulos y Zod valida los datos en los límites de entrada y salida. npm workspaces
permite instalar y ejecutar ambos proyectos desde la raíz con un solo lockfile.

SQLite evita configurar un servicio adicional y mantiene los datos en un archivo
local. Prisma aporta un cliente tipado, migraciones y consultas parametrizadas.
No se utilizan procedimientos almacenados. Para este CRUD pequeño se separan rutas,
validación, controlador, servicio y repositorio sin introducir servicios adicionales.

`Task.responsibleId` referencia a `TeamMember`, el catálogo de integrantes sin
autenticación. La consulta del catálogo está disponible desde la parte 11 y la
asignación por identificador desde la parte 12. El catálogo inicial contiene a Franco
Cabello y Oscar Perez; sus códigos son estables y sus identificadores dependen de cada base.
No son cuentas de acceso ni hay rutas administrativas para altas o bajas.
La eliminación de tareas es física. Si se
incorporan recuperación, permisos o historial, será necesario modificar el modelo,
la API, las pruebas y la documentación.

## Dónde están los controladores

Los controladores se definen en `backend/src/modules/tasks/task.controller.ts`.
Las rutas de `task.routes.ts` los conectan con los métodos HTTP. Los controladores
reciben datos ya validados, invocan el servicio y devuelven el código HTTP y el cuerpo.
El servicio aplica las reglas de la operación; el repositorio contiene las llamadas
al cliente Prisma. Los componentes React consumen un cliente HTTP centralizado.

El controlador del catálogo está en
`backend/src/modules/team-members/team-member.controller.ts`. Su flujo es ruta →
controlador → servicio → repositorio → Prisma/SQLite. El repositorio filtra activos,
ordena por nombre y código y selecciona solo los cuatro campos públicos del DTO
`TeamMemberSummary`. El middleware central trata los fallos inesperados. Esta
consulta no recibe cuerpo ni parámetros y no necesita un esquema Zod de entrada.

## Estructura del proyecto

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
    features/team-members/
      team-members.schema.ts Contrato del catálogo
      team-members.api.ts Consulta HTTP de integrantes activos
      useTeamMembers.ts Carga, error, reintento y cancelación del catálogo
    lib/api.ts        Cliente JSON compartido y errores HTTP
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
      task.service.ts     Campos editables, reglas de asignación y tareas inexistentes
      task.repository.ts  Consultas, selección pública y escrituras transaccionales
      task.schema.ts      Validaciones Zod y tipo de entrada
    lib/prisma.ts     Cliente Prisma de la aplicación
    modules/team-members/
      team-member.routes.ts     Ruta GET del catálogo
      team-member.controller.ts Respuesta HTTP del listado
      team-member.service.ts    Consulta de integrantes activos
      team-member.repository.ts Filtro, orden y selección de campos públicos
    generated/prisma/ Cliente generado localmente
    app.ts            Express, CORS, rutas, Swagger UI y middlewares
    server.ts         Inicio y cierre del servidor
  prisma/
    schema.prisma     Modelos de tareas, estados e integrantes
    migrations/       SQL versionado con restricciones
    ensure-database.ts Preparación del archivo SQLite
    seed.ts           Datos de ejemplo opcionales
    team-members.data.ts Integrantes iniciales confirmados
    team-members.seed.ts Validación y carga transaccional del catálogo
    seed-members.ts   Entrada del comando db:seed:members
  tests/              Pruebas de persistencia e integración de la API
    helpers/openapi.ts Validación del contrato en las pruebas HTTP
    openapi.test.ts    Validación de esquemas y ejemplos OpenAPI
    server-lifecycle.test.ts CRUD con proceso real y reinicios
    assignment-migration.test.ts Conservación y reversión de la migración de asignaciones
    team-members.test.ts Catálogo, restricciones, seed y migración desde el esquema anterior
    team-members-api.test.ts Consulta HTTP, activos, homónimos, errores y compatibilidad del CRUD
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

Para crear o editar, el repositorio abre una transacción, consulta el integrante y
ejecuta la regla de asignación definida en el servicio antes de escribir. Al editar,
consulta primero la asignación actual: una tarea inexistente devuelve 404 y una
asignación inactiva solo puede conservarse en esa misma tarea. La respuesta selecciona
los campos públicos de la tarea y del integrante. La clave foránea protege la
existencia y las bajas físicas; el estado activo se valida dentro de la transacción.

La migración de asignaciones conserva los datos anteriores y la secuencia de tareas.
Una coincidencia exacta y única de nombre reutiliza al integrante existente, incluso
si está inactivo. Si no hay una coincidencia única, crea un integrante histórico
inactivo conservando el nombre original; no deduce identidades entre homónimos.
La migración no depende del seed. Cargar el catálogo inicial después no modifica ni
reactiva esos registros. [Instalación y actualización con respaldo](asignaciones.md).

Prisma, su cliente y el adaptador SQLite están fijados en la misma versión estable 7.10.0.
El repositorio incluye overrides acotados para `deepmerge-ts` y `mysql2`, dependencias
indirectas de la CLI, con versiones corregidas de sus avisos de seguridad. No implican
el uso de MySQL por la aplicación. La generación, las migraciones y las pruebas verifican
la compatibilidad de esos ajustes.

## Listado de tareas en React

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

## Crear, editar y eliminar desde React

**Nueva tarea** y **Crear primera tarea** abren el mismo formulario que utiliza **Editar**.
Al crear, los textos empiezan vacíos y el estado es Pendiente. Al editar, se precargan
los cuatro campos de la tarea seleccionada; una descripción nula se presenta como texto vacío.

El formulario valida título obligatorio, integrante seleccionado y estado. Rechaza
títulos de espacios y limita título y descripción a 150 y 2.000 caracteres.
Recorta los espacios iniciales y finales antes de comprobar las longitudes. Una descripción
vacía se envía como `null`. Siempre se envían título, descripción, `responsibleId` y estado; el identificador
de la tarea y las fechas no se incluyen en el cuerpo de creación o edición.

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
2. Intenta crear con título vacío o de espacios y sin seleccionar responsable; comprueba los mensajes.
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
