/**
 * Contrato de almacenamiento de los documentos de proyecto.
 *
 * La aplicación no sabe dónde viven los bytes: le pide a una implementación de
 * `DocumentStorage` que los guarde, los lea o los borre. Cambiar de destino
 * (disco, base de datos o, en el futuro, almacenamiento de objetos) es escribir
 * otra implementación de este contrato, sin tocar las rutas.
 */

/** Identificación mínima de un archivo ya almacenado. */
export interface StoredFileRef {
	/** Clave con la que se sirve el archivo en `/api/files/:key`. */
	key: string;
	/** Backend que almacenó los bytes. El borrado lo respeta. */
	backend: string;
}

/** Registro de archivo, con sus bytes cuando el backend los guarda en la base. */
export interface StoredFile extends StoredFileRef {
	/** Bytes en línea, o `null` cuando el backend los guarda fuera de la base. */
	data: Uint8Array | null;
}

/** Implementación concreta de almacenamiento. */
export interface DocumentStorage {
	/** Nombre con el que se registra cada archivo que guarda. */
	readonly name: string;
	/** Persiste los bytes de un archivo ya registrado con esa clave. */
	save(file: { key: string; data: Buffer }): Promise<void>;
	/** Devuelve los bytes, o `null` si ya no están disponibles. */
	read(file: StoredFile): Promise<Buffer | null>;
	/** Elimina los bytes. No falla si ya no estaban. */
	remove(file: StoredFileRef): Promise<void>;
}
