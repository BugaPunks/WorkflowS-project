# Design

## Context

Hoy la subida y la descarga de documentos están acopladas al sistema de archivos del contenedor:

- `src/server/routes/documents.ts` usa `multer.diskStorage` con destino `UPLOADS_DIR` (por defecto `uploads/`) y guarda en `documents.url` la ruta relativa `/api/files/<nombre>`.
- `src/server/routes/files.ts` resuelve esa ruta con `fs.existsSync` + `res.sendFile`, después de autenticar y comprobar la pertenencia al proyecto buscando el documento por `url: { contains: filename }`.
- `src/server/index.ts` crea el directorio de uploads al arrancar.

En el plan gratuito de Render el disco es efímero, así que los archivos se pierden en cada despliegue y en cada reinicio. El resto de la aplicación ya vive fuera del contenedor: la base de datos está en Neon y el frontend se sirve como estático. El único estado atado al contenedor son los bytes de los documentos.

Restricciones:

- Sin método de pago: no hay volumen persistente en Render ni almacenamiento de objetos que no exija tarjeta o una cuenta nueva.
- La defensa es inminente, así que el cambio debe ser acotado y verificable.
- El contrato con el frontend (`/api/files/:key` más cookie de sesión) no puede romperse.

## Goals / Non-Goals

**Goals:**

- Que un documento subido siga siendo descargable después de un redespliegue, en un despliegue sin disco persistente.
- Que la decisión de dónde se guardan los bytes sea configurable y no esté dispersa en las rutas.
- Que los metadatos y los bytes nunca queden desincronizados (sin huérfanos, en ningún sentido).
- No tocar el frontend ni el contrato HTTP de descarga.
- No agregar cuentas, claves ni dependencias externas nuevas.

**Non-Goals:**

- Almacenamiento de objetos (S3/Cloudinary). Se deja como una implementación futura más del mismo contrato.
- Descarga parcial (`Range`), URLs firmadas, transformación de imágenes o miniaturas.
- Reemplazo del sistema de archivos para otros usos distintos de los documentos de proyecto.
- Migración de documentos ya existentes: se verificó que los del seed apuntan a URLs externas de ejemplo.

## Decisions

### D1 — Una interfaz de almacenamiento con dos implementaciones, en vez de elegir entre disco y base de datos

El servidor no guarda archivos: le pide a un objeto que cumpla `DocumentStorage` que los guarde. Hay dos implementaciones (`disk`, `postgres`) y un registro que las resuelve por nombre.

```ts
export interface StoredFile {
	key: string; // lo que aparece en /api/files/:key
	backend: string; // backend que almacenó los bytes
	data: Buffer | null; // null cuando el backend es de disco
}

export interface DocumentStorage {
	readonly name: string;
	save(file: { key: string; data: Buffer }): Promise<void>;
	read(file: StoredFile): Promise<Buffer | null>;
	remove(file: StoredFile): Promise<void>;
}
```

*Alternativas consideradas:*

- **Guardar todo en Postgres, sin abstracción.** Es el menor cambio posible, pero acopla el proyecto a una decisión de despliegue y hace que cualquier migración futura a almacenamiento de objetos toque las rutas. Rechazada por costo de cambio futuro.
- **Quedarse en disco y aceptar la pérdida.** Es lo que hace hoy el despliegue, y es la razón del cambio.
- **Almacenamiento de objetos gratuito.** Es la respuesta convencional, pero exige cuenta y claves nuevas (Cloudinary) o método de pago (R2) en la víspera de la defensa. El contrato deja la puerta abierta para agregarlo después escribiendo un tercer adaptador.

### D2 — El backend se elige para escribir, pero la fila manda para leer

`STORAGE_BACKEND` decide **dónde se escriben** los documentos nuevos (por defecto `disk`). La lectura no usa esa variable: usa el campo `backend` del registro del archivo.

Esto descarta el riesgo de la variante "híbrida" planteada antes, donde el destino dependía de si una variable estaba definida: allí, cambiar u olvidar la variable volvía inalcanzables los archivos guardados antes. Con la decisión por fila, cambiar la configuración de escritura es seguro por construcción.

*Alternativa considerada:* elegir el backend de lectura con la misma variable global. Rechazada explícitamente por el motivo anterior.

### D3 — Una tabla `document_files` 1:1 con `documents`, no una columna en `documents`

```prisma
model DocumentFile {
	id         String   @id @default(cuid())
	documentId String   @unique
	key        String   @unique
	mimeType   String
	size       Int
	backend    String
	data       Bytes?
	uploadedAt DateTime @default(now())

	document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

	@@map("document_files")
}
```

Los bytes viven en una tabla aparte porque Prisma selecciona todas las columnas escalares por defecto: si `data` estuviera en `documents`, el listado de documentos del panel arrastraría los megabytes de cada archivo. Además, la tabla separada es la que permite que `onDelete: Cascade` borre los bytes junto con el documento, y aloja los metadatos que antes se deducían de `url` y del sistema de archivos (tipo MIME y backend).

La relación es 1:1 porque cada fila de `documents` es un archivo concreto: el versionado ya crea una fila nueva por versión.

### D4 — Se resuelve el backend desde el registro, con la firma `read(StoredFile)`

`read` recibe el registro completo, no solo la clave, porque es el registro el que sabe en qué backend están sus bytes. Esto permite además dar un 404 explícito cuando un registro declara el backend de disco y el archivo no está (disco efímero ya vaciado), en lugar de un error interno.

### D5 — El borrado pasa por el backend y arregla una fuga existente

`DELETE /api/documents/:id` elimina hoy la fila pero deja el archivo en disco para siempre. A partir del cambio, la ruta obtiene el registro del archivo, invoca `remove()` del backend correspondiente y luego elimina el documento. En el backend de Postgres `remove()` no hace nada porque los bytes desaparecen con la fila vía `onDelete: Cascade`; en el de disco, borra el archivo.

### D6 — Clave de archivo generada y segura para URL

El nombre con el que se sirve un archivo deja de derivarse del nombre original y pasa a ser `<timestamp>-<aleatorio>-<nombre sano>`, donde el nombre sano conserva solo letras, dígitos, punto, guion y guion bajo. El nombre original se conserva en `documents.name` y se envía al cliente en `Content-Disposition` (con `filename*=UTF-8''`).

Motivo: el nombre original se usaba tal cual en la URL, de modo que un archivo llamado `acta #2.pdf` producía un enlace roto (el `#` trunca la URL) y un nombre con acentos o espacios dependía del recodificado del navegador. Como efecto secundario, la ruta de descarga deja de construir rutas del sistema de archivos a partir de un valor recibido por HTTP.

### D7 — Configuración: el valor por defecto es `disk`

`STORAGE_BACKEND` por defecto es `disk`, de modo que el desarrollo local y `docker-compose` se comportan como hasta ahora y no hace falta configurar nada. `render.yaml` fija `postgres` para el servicio desplegado, que es una decisión explícita y visible en el repositorio, en lugar de depender de que una variable falte.

## Risks / Trade-offs

- **La base de datos pasa a alojar archivos (1 GB en Neon, compartido con los datos, y el egreso cuenta contra la cuota de Neon).** → Es aceptable para el volumen de una sustentación (archivos de hasta 10 MB). Se documenta el límite y el contrato deja la puerta abierta a un backend de objetos.
- **El backend de Postgres lee y escribe los bytes por la conexión, sin CDN ni caché, con más latencia que un disco local.** → Aceptado a cambio de la persistencia. El tamaño máximo ya estaba acotado a 10 MB.
- **`multer.memoryStorage()` mantiene el archivo en memoria durante la petición.** → Acotado por el límite de 10 MB; el volumen de un proyecto de grado no lo hace problemático.
- **Dos implementaciones significan dos caminos que pueden divergir.** → La interfaz tiene tres métodos y se cubren ambos con pruebas; el backend de disco se prueba contra un directorio temporal y el de Postgres contra su registro.
- **Si el guardado de los bytes falla después de crear el documento, quedaría un documento sin contenido.** → La ruta revierte el documento creado en el `catch`, y hay una prueba para ese caso.
- **Un documento ya subido que apunte a `/api/files/...` sin registro en `document_files` dejaría de descargarse.** → Se verificó que los documentos existentes en los datos actuales tienen URLs externas de ejemplo; la descarga responde 404 explícito en lugar de fallar de forma opaca.
- **Se retira el requisito de `UPLOADS_DIR` como destino único.** → Es un cambio incompatible a nivel de especificación, no de datos: el backend de disco sigue honrando la variable y el despliegue nuevo define `STORAGE_BACKEND=postgres` explícitamente.

## Migration Plan

1. Agregar el modelo `DocumentFile` y la migración `document_files` (solo crea tabla e índices; no transforma datos).
2. Introducir `src/server/storage/` con el contrato y las dos implementaciones.
3. Migrar las rutas de subida, descarga y borrado al contrato.
4. Publicar la configuración: `STORAGE_BACKEND=postgres` en `render.yaml`; `disk` por defecto en el resto.
5. En el despliegue, el arranque aplica la migración con `prisma migrate deploy` (ya está en el script `start`).

**Rollback:** quitar `STORAGE_BACKEND` o ponerlo en `disk` devuelve las escrituras al disco sin afectar a los documentos guardados en la base de datos, porque cada fila declara su backend y la lectura lo respeta. La tabla `document_files` puede quedarse vacía de bytes sin afectar al resto del esquema.

## Open Questions

- Ninguna bloqueante. Queda como trabajo futuro evaluar un backend de almacenamiento de objetos cuando exista una cuenta sin requisitos de tarjeta, escribiendo un tercer adaptador del mismo contrato.
