import type { NotificationType } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, async (req, res) => {
	try {
		const preferences = await prisma.notificationPreference.findMany({
			where: { userId: req.user!.userId },
		});

		res.json({ data: preferences });
	} catch (error) {
		console.error("Error fetching preferences:", error);
		res.status(500).json({ error: "Error fetching preferences" });
	}
});

router.put("/:type", authenticateToken, async (req, res) => {
	try {
		const { type } = req.params;
		const { enabled } = req.body;

		const validTypes = [
			"TASK_ASSIGNED",
			"USER_STORY_ASSIGNED",
			"EVALUATION_COMPLETED",
			"MESSAGE",
			"PROJECT_ASSIGNED",
			"RETROSPECTIVE_ITEM",
			"SPRINT_COMPLETED",
		];
		if (!validTypes.includes(type)) {
			return res.status(400).json({ error: "Invalid notification type" });
		}

		if (typeof enabled !== "boolean") {
			return res.status(400).json({ error: "enabled must be a boolean" });
		}

		const preference = await prisma.notificationPreference.upsert({
			where: {
				userId_type: {
					userId: req.user!.userId,
					type: type as NotificationType,
				},
			},
			update: {
				enabled,
			},
			create: {
				userId: req.user!.userId,
				type: type as NotificationType,
				enabled,
			},
		});

		res.json({ data: preference });
	} catch (error) {
		console.error("Error updating preference:", error);
		res.status(500).json({ error: "Error updating preference" });
	}
});

export default router;
