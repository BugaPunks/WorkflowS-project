# Spec Delta

## ADDED Requirements

### Requirement: El almacenamiento de documentos usa un backend seleccionable

El servidor SHALL persistir los bytes de los documentos subidos mediante un backend de almacenamiento seleccionado por la variable `STORAGE_BACKEND`, con `disk` como valor por defecto cuando la variable no está definida o su valor no es reconocido, de modo que un despliegue sin disco persistente pueda guardar los bytes en la base de datos sin cambiar el resto del sistema. El servidor SHALL anunciar en el log de arranque qué backend de almacenamiento está usando para las escrituras.

#### Scenario: El backend de Postgres guarda en la base de datos

- **WHEN** el servidor arranca con `STORAGE_BACKEND=postgres` y un usuario sube un documento
- **THEN** los bytes quedan almacenados en la base de datos y no se escribe ningún archivo en el sistema de archivos

#### Scenario: Sin la variable se usa el disco

- **WHEN** el servidor arranca sin `STORAGE_BACKEND` definido y un usuario sube un documento
- **THEN** el archivo se almacena en el directorio indicado por `UPLOADS_DIR`

#### Scenario: Un valor desconocido no impide el arranque

- **WHEN** el servidor arranca con `STORAGE_BACKEND` definido con un valor no reconocido
- **THEN** arranca usando el backend de disco

#### Scenario: El log de arranque anuncia el backend

- **WHEN** el servidor arranca
- **THEN** el log de arranque indica qué backend de almacenamiento está activo para las escrituras

### Requirement: Cada archivo registra el backend en el que quedó guardado

El servidor SHALL registrar, para cada documento subido, los metadatos de sus bytes (la clave con la que se sirve, el tipo MIME y el tamaño) junto con el backend que los almacenó, en un registro relacionado uno a uno con el documento. La descarga SHALL resolver el backend a partir de ese registro y no de la configuración vigente, de modo que cambiar `STORAGE_BACKEND` nunca deje inalcanzable un documento ya guardado.

#### Scenario: Un documento guardado en un backend se descarga tras cambiar la configuración

- **WHEN** un documento se sube con un backend y el servidor se reinicia con otro backend configurado
- **THEN** el documento sigue siendo descargable

#### Scenario: Un archivo declarado en disco pero ausente responde 404

- **WHEN** un registro declara el backend de disco y el archivo ya no existe en el sistema de archivos
- **THEN** la descarga responde 404 y no un error interno

### Requirement: La descarga de documentos es autenticada y autorizada por proyecto

El servidor SHALL servir los bytes de un documento únicamente por `GET /api/files/:key`, SHALL exigir una sesión autenticada y SHALL exigir que quien descarga sea miembro del proyecto dueño del documento, con el rol administrador exento de la comprobación de pertenencia. La URL entregada al cliente SHALL ser independiente del backend de almacenamiento.

#### Scenario: Un miembro del proyecto descarga el archivo

- **WHEN** un miembro autenticado del proyecto solicita la clave de un documento
- **THEN** el servidor responde 200 con los bytes y el tipo MIME registrado

#### Scenario: Un usuario ajeno al proyecto no descarga el archivo

- **WHEN** un usuario autenticado que no pertenece al proyecto solicita la clave
- **THEN** el servidor responde 403

#### Scenario: Sin sesión no hay descarga

- **WHEN** una petición sin sesión solicita la clave
- **THEN** el servidor responde 401

#### Scenario: Una clave inexistente responde 404

- **WHEN** la petición solicita una clave que no corresponde a ningún documento registrado
- **THEN** el servidor responde 404

### Requirement: La subida valida tamaño y tipo de archivo

El servidor SHALL rechazar con 415 las subidas cuyo tipo MIME no esté en la lista de tipos permitidos y con 413 las subidas que superen el tamaño máximo configurado, y SHALL no persistir ni los bytes ni los metadatos cuando rechaza una subida.

#### Scenario: Un tipo no permitido no se almacena

- **WHEN** un usuario sube un archivo cuyo tipo MIME no está permitido
- **THEN** el servidor responde 415 y no se crea ningún documento

#### Scenario: Un archivo demasiado grande no se almacena

- **WHEN** un usuario sube un archivo que supera el tamaño máximo permitido
- **THEN** el servidor responde 413 y no se crea ningún documento

### Requirement: El fallo al guardar los bytes no deja metadatos huérfanos

El servidor SHALL revertir el registro del documento cuando falla la persistencia de sus bytes, de modo que nunca exista un documento sin contenido recuperable.

#### Scenario: El backend falla al guardar

- **WHEN** el backend de almacenamiento falla al persistir los bytes de un documento recién subido
- **THEN** la subida responde 500 y no queda ningún documento registrado para ese archivo

### Requirement: El borrado de un documento elimina sus bytes

El servidor SHALL eliminar los bytes almacenados cuando se elimina su documento: con el backend de disco, borrando el archivo del directorio de uploads; con el backend de Postgres, mediante la acción referencial de la relación, de modo que no queden bytes huérfanos ocupando espacio.

#### Scenario: El borrado en disco elimina el archivo

- **WHEN** se elimina un documento subido con el backend de disco
- **THEN** su archivo deja de existir en el directorio de uploads

#### Scenario: El borrado en Postgres elimina los bytes

- **WHEN** se elimina un documento subido con el backend de Postgres
- **THEN** su registro y sus bytes dejan de existir en la base de datos
