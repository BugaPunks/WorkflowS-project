import fs from "node:fs";
import { diskStorage, uploadsDir } from "./disk";
import { postgresStorage } from "./postgres";
import type { DocumentStorage } from "./types";

/** Implementaciones disponibles, resolubles por el nombre persistido. */
const backends: Record<string, DocumentStorage> = {
	disk: diskStorage,
	postgres: postgresStorage,
};

/** Backend histórico del proyecto: el sistema de archivos. */
export const DEFAULT_STORAGE_BACKEND = "disk";

/**
 * Resuelve el backend de escritura a partir de `STORAGE_BACKEND`, con el disco
 * como valor por defecto para un valor ausente o desconocido.
 */
export const resolveWriteBackend = (
	value: string | undefined = process.env.STORAGE_BACKEND,
): DocumentStorage => backends[value ?? DEFAULT_STORAGE_BACKEND] ?? diskStorage;

/** Backend con el que se guardan los documentos nuevos. */
export const writeBackend: DocumentStorage = resolveWriteBackend();

/**
 * Resuelve el backend de lectura a partir del nombre persistido en el archivo.
 *
 * Manda la fila y no la configuración vigente: así, cambiar `STORAGE_BACKEND`
 * nunca vuelve inalcanzable un documento ya guardado.
 */
export const backendFor = (name: string): DocumentStorage =>
	backends[name] ?? diskStorage;

/**
 * Prepara lo que el backend de escritura necesite. Con el disco hay que
 * asegurar el directorio; con Postgres no hay nada que preparar, de modo que un
 * despliegue sin disco persistente no crea directorios inútiles.
 */
export const ensureWriteBackendReady = (): void => {
	if (writeBackend.name !== "disk") return;
	if (!fs.existsSync(uploadsDir())) {
		fs.mkdirSync(uploadsDir(), { recursive: true });
	}
};

export { uploadsDir };
