# Tasks

## 1. Modelo de datos y migración

- [x] 1.1 En `prisma/schema.prisma`, añadir el modelo `DocumentFile` (1:1 con `Document`): `documentId` único, `key` único, `mimeType`, `size`, `backend`, `data Bytes?`, `uploadedAt`, con `onDelete: Cascade` hacia `documents` y `@@map("document_files")`; añadir la relación `file DocumentFile?` en `Document` y corregir el comentario de `size` (son bytes, no KB). Verificación: `npx prisma validate` en verde.
- [x] 1.2 Generar la migración SQL y guardarla en `prisma/migrations/20261016031000_document_files/migration.sql`. Nota: en la versión instalada de Prisma los flags cambiaron, así que el SQL se obtuvo con `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`. Verificación: sobre una base limpia (`workflows_scratch`) `npx prisma migrate deploy` aplica las dos migraciones y el diff posterior contra el esquema queda vacío (`-- This is an empty migration`).

## 2. Contrato de almacenamiento

- [x] 2.1 Crear `src/server/storage/types.ts` con la interfaz `DocumentStorage` (`name`, `save`, `read`, `remove`) y los tipos `StoredFile`/`StoredFileRef`. Verificación: `npx tsc --noEmit` en verde.
- [x] 2.2 Crear `src/server/storage/disk.ts`: escribe, lee y borra en `UPLOADS_DIR` (por defecto `uploads/`); `read` devuelve `null` si el archivo no existe y `remove` ignora el archivo ausente. Verificación: cubierto por las pruebas de la sección 5.
- [x] 2.3 Crear `src/server/storage/postgres.ts`: `save` actualiza el registro por `key`, `read` devuelve los bytes del registro, `remove` no hace nada porque el `onDelete: Cascade` se encarga. Verificación: cubierto por las pruebas de la sección 5.
- [x] 2.4 Crear `src/server/storage/index.ts` con el registro de backends, `resolveWriteBackend`/`writeBackend` (resueltos desde `STORAGE_BACKEND`, con `disk` por defecto y ante un valor no reconocido), `backendFor(name)` para la lectura y `ensureWriteBackendReady()`. Verificación: cubierto por las pruebas de la sección 5.

## 3. Rutas de subida, descarga y borrado

- [x] 3.1 En `src/server/routes/documents.ts`, cambiar `multer.diskStorage` por `multer.memoryStorage()` conservando la lista de tipos permitidos y el límite de 10 MB; generar la clave con `buildFileKey` (solo letras, dígitos, punto, guion y guion bajo). Verificación: la subida de `Acta #2 (final).pdf` produce la clave `...-Acta__2__final_.pdf` y el nombre real se conserva.
- [x] 3.2 En las dos rutas de subida, crear el documento con su registro de archivo anidado (`file: { create: { key, mimeType, size, backend: writeBackend.name } }`) y persistir los bytes con `writeBackend.save()`; en el `catch`, revertir el documento creado si el guardado falló. Verificación: cubierto por las pruebas de la sección 5.
- [x] 3.3 En `src/server/routes/files.ts`, reemplazar el acceso al sistema de archivos por la búsqueda del registro por `key` y la lectura con `backendFor(row.backend).read(row)`; conservar la autenticación y la comprobación de pertenencia al proyecto (con el bypass de administrador), responder 404 si el registro no existe o si el backend devuelve `null`, y enviar el `Content-Type` registrado junto con `Content-Disposition` con el nombre original. Verificación: cubierto por las pruebas de la sección 5 y por la verificación 6.3.
- [x] 3.4 En la ruta de borrado de `src/server/routes/documents.ts`, obtener el registro del archivo (solo `key` y `backend`, sin traer los bytes), invocar `remove()` del backend correspondiente y después eliminar el documento. Verificación: cubierto por las pruebas de la sección 5 y por la verificación 6.3.
- [x] 3.5 En `src/server/index.ts`, sustituir la creación incondicional del directorio de uploads por `ensureWriteBackendReady()` y añadir el backend de almacenamiento al log de arranque. Verificación: arrancar con `STORAGE_BACKEND=postgres` no crea el directorio y el log anuncia `Almacenamiento de documentos: postgres`.
- [x] 3.6 **(Hallazgo durante la implementación)** Los rechazos de multer no llegaban nunca al `try/catch` de la ruta: `upload.single()` es un middleware, así que su error pasaba al manejador por defecto de Express (que no existe en este servidor) y el cliente recibía un 500 en lugar de 415/413; las ramas que respondían esos códigos eran código inalcanzable. Se añadió el envoltorio `uploadSingle`, que responde 415 (tipo no permitido) y 413 (tamaño excedido) y delega los demás errores. Verificación: las pruebas de la sección 5 cubren ambos códigos.

## 4. Configuración y despliegue

- [x] 4.1 Documentar `STORAGE_BACKEND` en `.env.example`, indicando su valor por defecto (`disk`) y cuándo usar `postgres`; anotar junto a `UPLOADS_DIR` que solo lo lee el backend de disco. Verificación: inspección del archivo.
- [x] 4.2 En `render.yaml`, añadir `STORAGE_BACKEND=postgres` como variable del servicio. Verificación: inspección del archivo.
- [x] 4.3 Revisar `Dockerfile` y `docker-compose.yml`: el `Dockerfile` conserva la creación y el propietario de `/app/uploads` porque la imagen también debe poder correr con el backend de disco (es lo que hace la pila de `docker-compose` y lo que preserva el propietario del volumen), y `docker-compose.yml` fija `STORAGE_BACKEND: disk` explícitamente. Verificación: la pila de la sección 6 arranca con `disk`.
- [x] 4.4 Actualizar `docs/DESPLIEGUE-RENDER-NEON.md`: reescribir la sección "Persistencia de archivos subidos" con la tabla de backends, la nota del límite de 1 GB de Neon y el límite de 10 MB por archivo; añadir una fila de problemas frecuentes. Verificación: inspección del documento.

## 5. Pruebas automatizadas

- [x] 5.1 Crear `src/server/routes/documents-storage.test.ts` con el aislamiento habitual (mock de `../db` y middlewares reales): subida con el backend de disco en un directorio temporal, clave segura para nombres con espacios/`#`/paréntesis, tipo MIME no permitido responde 415 sin crear documento, archivo por encima del límite responde 413, y el fallo del backend revierte el documento creado. Verificación: `npm run test` en verde.
- [x] 5.2 Casos de autorización de la descarga: 401 sin sesión, 403 para un usuario ajeno al proyecto, 200 para un miembro con los bytes y el tipo registrado, 200 para administrador sin pertenencia y 404 para una clave inexistente. Verificación: `npm run test` en verde.
- [x] 5.3 Casos del backend de Postgres: `save` persiste los bytes en el registro, `read` los devuelve y devuelve `null` sin ellos; `resolveWriteBackend` y `backendFor` resuelven por nombre y caen en el disco ante un valor desconocido; un registro declarado en disco cuyo archivo falta responde 404. Verificación: `npm run test` en verde.
- [x] 5.4 Caso de borrado: con el backend de disco, el archivo deja de existir tras eliminar el documento. Verificación: `npm run test` en verde.

## 6. Verificación de integración

- [x] 6.1 `npx tsc --noEmit` en verde y `npm run check` (biome) en verde sobre 132 archivos.
- [x] 6.2 `npm run test` en verde: 139 pruebas en 14 archivos, sin regresiones sobre las 122 existentes.
- [x] 6.3 Verificación manual end-to-end con el backend de Postgres sobre una base recién migrada: login, subida 201, descarga 200 con los bytes idénticos y el `Content-Disposition` con el nombre original, el directorio de `UPLOADS_DIR` **no existe** (nada se escribió en disco), borrado 200 y descarga posterior 404; en la base quedan 0 filas en `document_files` (cascada).
- [x] 6.4 Verificación de la pila de `docker-compose` (Plan B) con el backend de disco: la imagen se reconstruye y la subida y la descarga siguen funcionando.
- [x] 6.5 `openspec validate --all` en verde.

## Workflow follow-up

- Archivar el change con `openspec archive postgres-document-storage --yes` tras completar la verificación.
