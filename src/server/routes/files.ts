import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { backendFor } from "../storage";

const router = Router();

/**
 * `Content-Disposition` que conserva el nombre original del documento.
 *
 * El nombre ASCII es el respaldo para clientes antiguos; `filename*` lleva el
 * nombre real codificado, lo que además impide inyectar cabeceras a través del
 * nombre de un archivo subido.
 */
const contentDisposition = (name: string): string => {
	const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

router.get("/:key", authenticateToken, async (req, res) => {
	try {
		const { key } = req.params;

		// Solo se leen los metadatos aquí: los bytes (hasta 10 MB con el backend
		// de Postgres) se piden después de verificar el acceso al proyecto, así
		// las peticiones rechazadas no consumen memoria ni tráfico de la base.
		const file = await prisma.documentFile.findUnique({
			where: { key },
			select: {
				key: true,
				mimeType: true,
				size: true,
				backend: true,
				document: { select: { id: true, projectId: true, name: true } },
			},
		});

		if (!file) {
			return res.status(404).json({ error: "Archivo no encontrado" });
		}

		// Check project access (ADMIN bypass for teachers)
		if (req.user?.role !== "ADMIN") {
			const membership = await prisma.projectMember.findUnique({
				where: {
					projectId_userId: {
						projectId: file.document.projectId,
						userId: req.user?.userId || "",
					},
				},
			});
			if (!membership) return res.sendStatus(403);
		}

		// Los bytes solo se necesitan una vez pasado el control de acceso. Con el
		// backend de Postgres se piden ahora, para no traerlos en la consulta
		// inicial; con el de disco el backend los lee del sistema de archivos.
		let fileForRead: {
			key: string;
			mimeType: string;
			size: number;
			backend: string;
			data: Uint8Array | null;
			document: { id: string; projectId: string; name: string };
		} = { ...file, data: null };
		if (file.backend === "postgres") {
			const bytesRow = await prisma.documentFile.findUnique({
				where: { key },
				select: { data: true },
			});
			fileForRead = { ...file, data: bytesRow?.data ?? null };
		}

		const bytes = await backendFor(file.backend).read(fileForRead);

		if (!bytes) {
			// El registro existe pero los bytes no: ocurre cuando el archivo
			// vivía en un disco efímero que ya se vació con un redespliegue.
			return res.status(404).json({ error: "Archivo no encontrado" });
		}

		res.setHeader("Content-Type", file.mimeType);
		res.setHeader("Content-Length", bytes.length);
		res.setHeader(
			"Content-Disposition",
			contentDisposition(file.document.name),
		);
		res.send(bytes);
	} catch (error) {
		console.error("Error downloading file:", error);
		res.status(500).json({ error: "Error al descargar archivo" });
	}
});

export default router;
