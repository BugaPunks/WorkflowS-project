import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// GET notificaciones de un usuario - own or ADMIN
router.get("/", authenticateToken, async (req, res) => {
	try {
		const { userId } = req.query;
		if (!userId) return res.status(400).json({ error: "Falta userId" });

		// Only allow users to see their own notifications or ADMIN
		if (req.user?.userId !== String(userId) && req.user?.role !== "ADMIN") {
			return res.sendStatus(403);
		}

		const notifications = await prisma.notification.findMany({
			where: { userId: String(userId) },
			orderBy: { createdAt: "desc" },
			take: 20,
		});
		res.json({ data: notifications });
	} catch (_error) {
		res.status(500).json({ error: "Error al obtener notificaciones" });
	}
});

// PUT marcar como leída - own or ADMIN
router.put("/:id/read", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;

		// Verify ownership
		const notification = await prisma.notification.findUnique({
			where: { id },
		});
		if (!notification)
			return res.status(404).json({ error: "Notificación no encontrada" });

		if (
			req.user?.userId !== notification.userId &&
			req.user?.role !== "ADMIN"
		) {
			return res.sendStatus(403);
		}

		await prisma.notification.update({
			where: { id },
			data: { read: true },
		});
		res.json({ message: "Marcada como leída" });
	} catch (_error) {
		res.status(500).json({ error: "Error al actualizar notificación" });
	}
});

export default router;
