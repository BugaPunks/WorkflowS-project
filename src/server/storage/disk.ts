import fs from "node:fs";
import path from "node:path";
import type { DocumentStorage, StoredFile, StoredFileRef } from "./types";

/**
 * Directorio del backend de disco. Se lee en cada uso para que las pruebas
 * puedan apuntarlo a un directorio temporal.
 */
export const uploadsDir = (): string => process.env.UPLOADS_DIR || "uploads";

const filePath = (key: string): string => path.join(uploadsDir(), key);

/**
 * Guarda los archivos en el sistema de archivos. Es el backend del desarrollo
 * local y de cualquier despliegue con un volumen persistente montado en
 * `UPLOADS_DIR`; en un contenedor sin disco persistente los bytes se pierden en
 * cada despliegue, por eso existe el backend de Postgres.
 */
export const diskStorage: DocumentStorage = {
	name: "disk",

	async save(file: { key: string; data: Buffer }): Promise<void> {
		await fs.promises.writeFile(filePath(file.key), file.data);
	},

	async read(file: StoredFile): Promise<Buffer | null> {
		try {
			return await fs.promises.readFile(filePath(file.key));
		} catch {
			// Fila registrada pero archivo ausente: quien llama responde 404.
			return null;
		}
	},

	async remove(file: StoredFileRef): Promise<void> {
		try {
			await fs.promises.unlink(filePath(file.key));
		} catch (error) {
			// Un archivo ya ausente no es un error: borrar es idempotente.
			if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
				return;
			}
			// Cualquier otro fallo (volcado de solo lectura, permisos, etc.)
			// se propaga para que la fila/documento no desaparezca sin dejar
			// constancia del bytes que quedaron huérfanos y permita reintentar.
			throw error;
		}
	},
};
