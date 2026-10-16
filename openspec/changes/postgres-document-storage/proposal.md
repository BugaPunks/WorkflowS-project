# Proposal

## Why

En el plan gratuito de Render el contenedor no tiene disco persistente: la carpeta `uploads/` se vacía en cada despliegue y en cada reinicio, así que todo documento que un usuario suba desaparece. Un volumen persistente exige una instancia paga (y por tanto un método de pago), y el almacenamiento de objetos gratuito disponible (Cloudinary, Cloudflare R2) exige crear una cuenta nueva o agregar una tarjeta, justo antes de la sustentación. La base de datos, en cambio, ya vive fuera del contenedor (Neon), de modo que guardar ahí los bytes resuelve la persistencia sin agregar ninguna dependencia nueva.

Además, el borrado de documentos es hoy inconsistente: `DELETE /api/documents/:id` elimina la fila de `documents` pero deja el archivo en disco para siempre, sin forma de recuperarlo ni de reclamar el espacio.

## What Changes

- **Almacenamiento de documentos configurable**: nueva variable `STORAGE_BACKEND` (`disk` por defecto, `postgres` para despliegues sin disco persistente). El servidor deja de asumir un único destino de almacenamiento.
- **Contrato de almacenamiento**: nuevo `src/server/storage/` con una interfaz `DocumentStorage` (`save`, `read`, `remove`) y dos implementaciones: `disk` (usa `UPLOADS_DIR`, comportamiento actual) y `postgres` (bytes en la base de datos).
- **Backend por fila, no global**: nueva tabla `document_files` (1:1 con `documents`) que registra `key`, `mimeType`, `size`, `backend` y, únicamente para el backend de Postgres, los bytes (`data`). La descarga resuelve el backend a partir de la fila, de modo que cambiar la configuración de escritura no deja inalcanzables los archivos ya guardados.
- **Subida sin tocar el disco**: `multer.memoryStorage()`; el archivo pasa por memoria y se persiste con el backend configurado. Si el guardado falla, se revierte la fila creada para no dejar metadatos huérfanos.
- **Borrado consistente**: `DELETE /api/documents/:id` invoca `remove()` del backend correspondiente; en Postgres los bytes desaparecen por `onDelete: Cascade`. Se elimina la fuga actual.
- **Contrato HTTP intacto**: la URL sigue siendo `/api/files/:key`, con la misma autenticación y la misma verificación de pertenencia al proyecto. El frontend no cambia.
- **BREAKING (operativo)**: se retira el requisito de que los documentos se almacenen en `UPLOADS_DIR`. La variable sigue existiendo, pero solo la usa el backend de disco; un despliegue sin disco persistente debe definir `STORAGE_BACKEND=postgres`.
- **Configuración y documentación**: `.env.example` documenta `STORAGE_BACKEND`; `render.yaml` fija `postgres` para el servicio desplegado y `docker-compose.yml` conserva `disk`.

## Capabilities

### New Capabilities
- `document-storage`: subida y descarga de los documentos de un proyecto mediante un backend de almacenamiento seleccionable por configuración, con los metadatos en la base de datos y los bytes fuera del contenedor cuando el despliegue no ofrece disco persistente.

### Modified Capabilities
- `runtime-configuration`: el template `.env.example` pasa a documentar `STORAGE_BACKEND`, y se retira el requisito de que los documentos subidos vivan en el directorio indicado por `UPLOADS_DIR`.

## Impact

- Backend: `src/server/storage/` (nuevo: `types.ts`, `disk.ts`, `postgres.ts`, `index.ts`), `src/server/routes/documents.ts` (multer en memoria, guardado por backend, borrado que limpia los bytes), `src/server/routes/files.ts` (lectura resuelta por fila), `src/server/index.ts` (deja de crear el directorio de uploads cuando el backend no es de disco).
- Datos: `prisma/schema.prisma` (modelo `DocumentFile` y su relación 1:1 con `Document`), nueva migración `document_files`. No hay datos que migrar: los documentos del seed apuntan a URLs externas de ejemplo, no a `/api/files/...`.
- Configuración y despliegue: `.env.example`, `render.yaml`, `docker-compose.yml`, `Dockerfile` (deja de requerir el directorio para el arranque en producción).
- Docs: `docs/DESPLIEGUE-RENDER-NEON.md` (deja de advertir sobre uploads efímeros y explica el backend en uso).
- Tests: subida y descarga reales con el backend de disco en un directorio temporal, cobertura del backend de Postgres y de la autorización del endpoint de descarga.
- Riesgo asumido: si existiera un documento ya subido apuntando a `/api/files/...` sin fila en `document_files`, su descarga respondería 404 explícito en lugar de servirse. Se verificó que no es el caso en los datos actuales.
