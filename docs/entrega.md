# Publicación y entrega

[Volver al README](../README.md).

## Antes del último commit

1. Ejecuta `npm run check` y comprueba que termine sin errores.
2. Completa el recorrido CRUD de [verificación](verificacion.md) y comprueba Swagger.
3. Revisa los cambios y confirma que las guías coincidan con los comandos y valores del proyecto.
4. Comprueba que el repositorio incluya frontend, backend, ejemplos de entorno,
   lockfile, migraciones SQL y documentación. Los `.env`, bases locales, dependencias
   y compilaciones permanecen fuera del repositorio.

## Commit y push manuales de la parte 9

El candidato ejecuta los siguientes comandos desde la raíz:

```bash
git status
git diff
git add README.md backend/.env.example frontend/.env.example docs
git diff --cached
git commit -m "docs: explicar la instalación desde cero y preparar la entrega"
git push
```

Estos comandos corresponden a los archivos de documentación de este avance. Revisa
`git diff --cached` antes de confirmar. Después del push, comprueba que CI esté en
verde para **ese último commit**, tanto en Windows como en Ubuntu.

## Comprobación desde un clon limpio

Abre una terminal en una carpeta distinta de tu instalación habitual. La carpeta
`gestion-tareas-entrega` del ejemplo debe estar libre:

```bash
git clone https://github.com/FrancoCabelloDev/prueba_tec_Kayser.git gestion-tareas-entrega
cd gestion-tareas-entrega
```

Sigue los pasos del README: instalar, copiar los ejemplos `.env`, generar Prisma,
aplicar las migraciones y arrancar. No copies tu `dev.db`, `node_modules`, `dist` ni
el cliente generado desde la instalación anterior.

Si la primera copia sigue usando los puertos 3000 y 5173, detén sus servidores o
utiliza los [puertos alternativos documentados](solucion-de-problemas.md#puertos-ocupados).
Cada clon usa su propio SQLite. Crear una tarea en el clon nuevo no modifica la base
de la instalación anterior.

Comprueba aplicación, salud, Swagger, CRUD, persistencia tras reiniciar y `npm run check`.
Si detectas un problema, corrige el repositorio y publica otro commit antes de enviar la entrega.

## Correo de entrega

El envío lo realiza el candidato. Incluye el enlace del repositorio y remite al README
para la instalación. Si el repositorio es privado, asegúrate de que el evaluador tenga
acceso. No es necesario adjuntar bases de datos ni dependencias.

Texto sugerido para adaptar antes de enviar:

```text
Asunto: Entrega de prueba técnica — Gestión de tareas de TI

Hola:

Comparto el repositorio de la solución:
https://github.com/FrancoCabelloDev/prueba_tec_Kayser

El README incluye los requisitos y las instrucciones para instalar dependencias,
configurar el entorno, crear la base de datos y ejecutar frontend y backend.
La aplicación utiliza React, Node.js y SQLite. La API incluye Swagger.

Saludos,
[Tu nombre]
```

## Preparación para la revisión técnica

Practica la explicación de una operación completa:

```text
Formulario → cliente HTTP → ruta → validación → controlador
→ servicio → repositorio Prisma → SQLite → respuesta → actualización del listado
```

Explica por qué la base es local, dónde están los controladores, cómo se validan los
campos, por qué PUT recibe los cuatro datos y cómo se traduce una tarea inexistente
a `404`. Revisa también las migraciones, la eliminación física, las pruebas aisladas
y las diferencias entre errores de formulario, conexión y servidor.

Para agregar un campo, identifica los cambios necesarios en el modelo y la migración,
los esquemas Zod, el contrato OpenAPI, el formulario y las pruebas. La solución debe
poder ser explicada y mantenida por el candidato.
