import { prisma } from "../db";
import type { DocumentStorage, StoredFile } from "./types";

/**
 * Guarda los bytes dentro de la base de datos, en la fila que ya registra sus
 * metadatos. Es el backend de los despliegues sin disco persistente: nada se
 * escribe en el sistema de archivos del contenedor, así que los documentos
 * sobreviven a los redespliegues.
 *
 * Límite conocido: los bytes ocupan el mismo almacenamiento que los datos.
 */
export const postgresStorage: DocumentStorage = {
	name: "postgres",

	async save(file: { key: string; data: Buffer }): Promise<void> {
		await prisma.documentFile.update({
			where: { key: file.key },
			// Copia a un Uint8Array propio: Prisma no acepta el Buffer de Node,
			// cuyo ArrayBuffer subyacente puede ser compartido.
			data: { data: new Uint8Array(file.data) },
		});
	},

	async read(file: StoredFile): Promise<Buffer | null> {
		return file.data ? Buffer.from(file.data) : null;
	},

	async remove(): Promise<void> {
		// Los bytes mueren con la fila (onDelete: Cascade). Nada que borrar aquí.
	},
};
