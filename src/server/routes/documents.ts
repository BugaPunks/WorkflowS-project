import { Router } from "express";
import multer from "multer";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireProjectRole } from "../middleware/project-rbac";

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

// Configuración de Multer para almacenamiento local
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, "uploads/");
	},
	filename: (_req, file, cb) => {
		const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
		cb(null, `${uniqueSuffix}-${file.originalname}`);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: MAX_FILE_SIZE },
	fileFilter: (_req, file, cb) => {
		if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Tipo de archivo no permitido"));
		}
	},
});

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
	upload.single("file"),
	async (req, res) => {
		try {
			const { projectId } = req.params;
			const file = req.file;

			if (!file) return res.status(400).json({ error: "No se envió archivo" });

			const name = Buffer.from(file.originalname, "latin1").toString("utf8");
			const type = file.mimetype.split("/").pop()?.toUpperCase() || "FILE";
			const size = file.size;
			const url = `/api/files/${file.filename}`;

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
				const newVersion = lastVersion + 1;

				const version = await prisma.document.create({
					data: {
						projectId,
						name,
						type,
						size,
						url,
						version: newVersion,
						parentId: existingDoc.id,
					},
				});
				return res.status(201).json(version);
			}

			const document = await prisma.document.create({
				data: {
					projectId,
					name,
					type,
					size,
					url,
					version: 1,
				},
			});

			res.status(201).json(document);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === "Tipo de archivo no permitido"
			) {
				return res.status(415).json({ error: "Tipo de archivo no permitido" });
			}
			if (
				error instanceof multer.MulterError &&
				error.code === "LIMIT_FILE_SIZE"
			) {
				return res
					.status(413)
					.json({ error: "Archivo excede el límite de 10MB" });
			}
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
	upload.single("file"),
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
			const newVersion = lastVersion + 1;

			const name = Buffer.from(file.originalname, "latin1").toString("utf8");
			const type = file.mimetype.split("/").pop()?.toUpperCase() || "FILE";
			const size = file.size;
			const url = `/api/files/${file.filename}`;

			const document = await prisma.document.create({
				data: {
					projectId: parentDoc.projectId,
					name,
					type,
					size,
					url,
					version: newVersion,
					parentId: parentDoc.id,
				},
			});

			res.status(201).json(document);
		} catch (error) {
			if (
				error instanceof multer.MulterError &&
				error.code === "LIMIT_FILE_SIZE"
			) {
				return res
					.status(413)
					.json({ error: "Archivo excede el límite de 10MB" });
			}
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
			await prisma.document.delete({ where: { id: req.params.id } });
			res.json({ message: "Documento eliminado" });
		} catch (_error) {
			res.status(500).json({ error: "Error al eliminar documento" });
		}
	},
);

export default router;
