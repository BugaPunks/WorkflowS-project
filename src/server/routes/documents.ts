import { type RequestHandler, Router } from "express";
import multer from "multer";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireProjectRole } from "../middleware/project-rbac";
import { backendFor, writeBackend } from "../storage";

const router = Router();

const ALLOWED_MIME_TYPES = [
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/msword",
	"image/png",
	"image/jpeg",
	"image/gif",
	"text/plain",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-excel",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Clave con la que se sirve un archivo (`/api/files/:key`).
 *
 * El nombre original se reduce a caracteres seguros para una URL: uno con
 * espacios, acentos o `#` produciría un enlace roto, porque el `#` truncaría la
 * URL. El nombre original se conserva en `documents.name` y se devuelve en la
 * descarga.
 */
const buildFileKey = (originalName: string): string => {
	const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
	const safeName = originalName.replace(/[^A-Za-z0-9._-]/g, "_");
	return `${unique}-${safeName}`;
};

// Los archivos pasan por memoria: el destino lo decide el backend configurado,
// así que la subida nunca escribe por su cuenta en el disco del contenedor.
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_FILE_SIZE },
	fileFilter: (_req, file, cb) => {
		if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Tipo de archivo no permitido"));
		}
	},
});

/**
 * Envuelve el middleware de multer para responder los rechazos de subida con su
 * código HTTP.
 *
 * Sin esto, el error de multer pasa al manejador por defecto de Express (que no
 * existe en este servidor) y el cliente recibe un 500 genérico en lugar de
 * saber que el tipo no está permitido (415) o que el archivo excede el límite
 * (413). El middleware se ejecuta antes del manejador de la ruta, así que su
 * error nunca llega al `try/catch` de esta.
 */
const uploadSingle: RequestHandler = (req, res, next) => {
	upload.single("file")(req, res, (error: unknown) => {
		if (!error) return next();

		if (
			error instanceof multer.MulterError &&
			error.code === "LIMIT_FILE_SIZE"
		) {
			return res
				.status(413)
				.json({ error: "Archivo excede el límite de 10MB" });
		}

		if (
			error instanceof Error &&
			error.message === "Tipo de archivo no permitido"
		) {
			return res.status(415).json({ error: "Tipo de archivo no permitido" });
		}

		return next(error);
	});
};

/**
 * Registra el documento con sus metadatos y persiste sus bytes con el backend
 * configurado. Si el guardado falla, revierte el documento creado para no dejar
 * metadatos sin contenido recuperable.
 */
const createDocumentWithFile = async (params: {
	projectId: string;
	name: string;
	type: string;
	file: Express.Multer.File;
	version: number;
	parentId: string | null;
}) => {
	const { projectId, name, type, file, version, parentId } = params;
	const key = buildFileKey(name);

	const document = await prisma.document.create({
		data: {
			projectId,
			name,
			type,
			size: file.size,
			url: `/api/files/${key}`,
			version,
			parentId,
			file: {
				create: {
					key,
					mimeType: file.mimetype,
					size: file.size,
					backend: writeBackend.name,
				},
			},
		},
	});

	try {
		await writeBackend.save({ key, data: file.buffer });
	} catch (error) {
		await prisma.document
			.delete({ where: { id: document.id } })
			.catch(() => undefined);
		throw error;
	}

	return document;
};

// GET documentos de un proyecto - any project member
router.get(
	"/:projectId",
	authenticateToken,
	requireProjectRole(["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"]),
	async (req, res) => {
		try {
			const { projectId } = req.params;
			const documents = await prisma.document.findMany({
				where: {
					projectId,
					parentId: null,
				},
				include: {
					versions: {
						orderBy: { version: "desc" },
					},
				},
				orderBy: { uploadedAt: "desc" },
			});

			const result = documents.map((doc) => {
				const maxVersion =
					doc.versions.length > 0
						? Math.max(...doc.versions.map((v) => v.version), doc.version)
						: doc.version;

				return {
					...doc,
					latestVersion: maxVersion,
					versionCount: doc.versions.length + 1,
				};
			});

			res.json({ data: result });
		} catch (_error) {
			res.status(500).json({ error: "Error al obtener documentos" });
		}
	},
);

// POST subir documento - any project member
router.post(
	"/:projectId",
	authenticateToken,
	requireProjectRole(["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"]),
	uploadSingle,
	async (req, res) => {
		try {
			const { projectId } = req.params;
			const file = req.file;

			if (!file) return res.status(400).json({ error: "No se envió archivo" });

			const name = Buffer.from(file.originalname, "latin1").toString("utf8");
			const type = file.mimetype.split("/").pop()?.toUpperCase() || "FILE";

			const existingDoc = await prisma.document.findFirst({
				where: {
					projectId,
					name,
					parentId: null,
				},
				include: {
					versions: {
						orderBy: { version: "desc" },
						take: 1,
					},
				},
			});

			if (existingDoc) {
				const lastVersion =
					existingDoc.versions.length > 0
						? existingDoc.versions[0].version
						: existingDoc.version;

				const version = await createDocumentWithFile({
					projectId,
					name,
					type,
					file,
					version: lastVersion + 1,
					parentId: existingDoc.id,
				});
				return res.status(201).json(version);
			}

			const document = await createDocumentWithFile({
				projectId,
				name,
				type,
				file,
				version: 1,
				parentId: null,
			});

			res.status(201).json(document);
		} catch (error) {
			// Los rechazos de multer (tipo o tamaño) ya se responden en
			// `uploadSingle`; acá solo llegan fallos al persistir el documento.
			console.error(error);
			res.status(500).json({ error: "Error al subir documento" });
		}
	},
);

// POST subir nueva versión explícita - any project member
router.post(
	"/:id/versions",
	authenticateToken,
	requireProjectRole(["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"]),
	uploadSingle,
	async (req, res) => {
		try {
			const { id } = req.params;
			const file = req.file;

			if (!file) return res.status(400).json({ error: "No se envió archivo" });

			const parentDoc = await prisma.document.findUnique({
				where: { id },
				include: {
					versions: {
						orderBy: { version: "desc" },
						take: 1,
					},
				},
			});

			if (!parentDoc) {
				return res
					.status(404)
					.json({ error: "Documento original no encontrado" });
			}

			if (parentDoc.parentId) {
				return res.status(400).json({
					error:
						"No se puede crear una versión de una versión. Use el ID del documento original.",
				});
			}

			const lastVersion =
				parentDoc.versions.length > 0
					? parentDoc.versions[0].version
					: parentDoc.version;

			const name = Buffer.from(file.originalname, "latin1").toString("utf8");
			const type = file.mimetype.split("/").pop()?.toUpperCase() || "FILE";

			const document = await createDocumentWithFile({
				projectId: parentDoc.projectId,
				name,
				type,
				file,
				version: lastVersion + 1,
				parentId: parentDoc.id,
			});

			res.status(201).json(document);
		} catch (error) {
			// Los rechazos de multer ya se responden en `uploadSingle`.
			console.error(error);
			res.status(500).json({ error: "Error al crear nueva versión" });
		}
	},
);

// GET historial de versiones - any authenticated
router.get("/:id/versions", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const doc = await prisma.document.findUnique({
			where: { id },
		});

		if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

		const parentId = doc.parentId || doc.id;

		const history = await prisma.document.findMany({
			where: {
				OR: [{ id: parentId }, { parentId: parentId }],
			},
			orderBy: { version: "desc" },
		});

		res.json({ data: history });
	} catch (_error) {
		res.status(500).json({ error: "Error al obtener versiones" });
	}
});

// DELETE documento - SCRUM_MASTER, PRODUCT_OWNER
router.delete(
	"/:id",
	authenticateToken,
	requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"], async (req) => {
		const doc = await prisma.document.findUnique({
			where: { id: req.params.id },
		});
		return doc?.projectId ?? null;
	}),
	async (req, res) => {
		try {
			const { id } = req.params;

			// Se leen solo la clave y el backend: los bytes no hacen falta para
			// borrarlos y no tiene sentido traerlos de la base.
			const document = await prisma.document.findUnique({
				where: { id },
				select: { file: { select: { key: true, backend: true } } },
			});

			if (document?.file) {
				await backendFor(document.file.backend).remove(document.file);
			}

			await prisma.document.delete({ where: { id } });
			res.json({ message: "Documento eliminado" });
		} catch (_error) {
			res.status(500).json({ error: "Error al eliminar documento" });
		}
	},
);

export default router;
