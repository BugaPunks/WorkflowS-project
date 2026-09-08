import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/:filename", authenticateToken, async (req, res) => {
	try {
		const { filename } = req.params;
		const filePath = path.join("uploads", filename);

		if (!fs.existsSync(filePath)) {
			return res.status(404).json({ error: "Archivo no encontrado" });
		}

		const document = await prisma.document.findFirst({
			where: { url: { contains: filename } },
		});

		if (!document) {
			return res.status(404).json({ error: "Documento no encontrado" });
		}

		// Check project access (ADMIN bypass for teachers)
		if (req.user?.role !== "ADMIN") {
			const membership = await prisma.projectMember.findUnique({
				where: {
					projectId_userId: {
						projectId: document.projectId,
						userId: req.user?.userId || "",
					},
				},
			});
			if (!membership) return res.sendStatus(403);
		}

		res.sendFile(path.resolve(filePath));
	} catch (error) {
		console.error("Error downloading file:", error);
		res.status(500).json({ error: "Error al descargar archivo" });
	}
});

export default router;
