import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { notify } from "../lib/notify";
import { authenticateToken } from "../middleware/auth";
import { requireProjectRole } from "../middleware/project-rbac";

const router = Router();

const messageSchema = z.object({
	content: z.string().min(1).max(5000),
});

// GET mensajes de un proyecto - any project member
router.get(
	"/:projectId/messages",
	authenticateToken,
	requireProjectRole(["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"]),
	async (req, res) => {
		try {
			const { projectId } = req.params;

			let chat = await prisma.chat.findFirst({
				where: { projectId },
				include: {
					messages: {
						include: { user: true },
						orderBy: { createdAt: "asc" },
					},
				},
			});

			if (!chat) {
				chat = await prisma.chat.create({
					data: { projectId },
					include: {
						messages: { include: { user: true } },
					},
				});
			}

			res.json({ data: chat.messages || [] });
		} catch (error) {
			console.error("Error fetching messages:", error);
			res.status(500).json({ error: "Error al obtener mensajes" });
		}
	},
);

// POST enviar mensaje - any project member
router.post(
	"/:projectId/messages",
	authenticateToken,
	requireProjectRole(["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"]),
	async (req, res) => {
		try {
			const { projectId } = req.params;
			const parsed = messageSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Contenido requerido" });
			}

			const userId = req.user?.userId;
			const { content } = parsed.data;

			if (!userId) {
				return res.status(401).json({ error: "No autenticado" });
			}

			let chat = await prisma.chat.findFirst({
				where: { projectId },
			});

			if (!chat) {
				chat = await prisma.chat.create({
					data: { projectId, type: "PROJECT" },
				});
			}

			const message = await prisma.message.create({
				data: {
					chatId: chat.id,
					userId,
					content,
				},
				include: { user: true },
			});

			res.status(201).json({ data: message });
		} catch (error) {
			console.error("Error sending message:", error);
			res.status(500).json({ error: "Error al enviar mensaje" });
		}
	},
);

// GET mis chats (DMs) - any authenticated
router.get("/user/:userId/all", authenticateToken, async (req, res) => {
	try {
		const { userId } = req.params;

		// Only allow users to see their own chats or ADMIN
		if (req.user?.userId !== userId && req.user?.role !== "ADMIN") {
			return res.sendStatus(403);
		}

		const directChats = await prisma.chat.findMany({
			where: {
				type: "DIRECT",
				participants: { some: { userId } },
			},
			include: {
				participants: {
					include: { user: { select: { id: true, name: true, avatar: true } } },
				},
				messages: { orderBy: { createdAt: "desc" }, take: 1 },
			},
		});

		res.json({ data: directChats });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Error loading chats" });
	}
});

// POST crear/obtener DM - any authenticated
router.post("/direct", authenticateToken, async (req, res) => {
	try {
		const { targetUserId } = req.body;
		const userId = req.user?.userId;

		if (!userId || !targetUserId) {
			return res.status(400).json({ error: "Faltan datos" });
		}

		const myChats = await prisma.chat.findMany({
			where: {
				type: "DIRECT",
				participants: { some: { userId } },
			},
			include: { participants: true },
		});

		const existing = myChats.find((c) =>
			c.participants.some((p) => p.userId === targetUserId),
		);

		if (existing) return res.json({ data: existing });

		const chat = await prisma.chat.create({
			data: {
				type: "DIRECT",
				participants: {
					create: [{ userId }, { userId: targetUserId }],
				},
			},
		});
		res.json({ data: chat });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Error creating DM" });
	}
});

// GET messages for specific chat (by ID) - any authenticated
router.get(
	"/conversation/:chatId/messages",
	authenticateToken,
	async (req, res) => {
		try {
			const { chatId } = req.params;
			const messages = await prisma.message.findMany({
				where: { chatId },
				include: { user: true },
				orderBy: { createdAt: "asc" },
			});
			res.json({ data: messages });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Error fetching messages" });
		}
	},
);

// POST message to specific chat (by ID) - any authenticated
router.post(
	"/conversation/:chatId/messages",
	authenticateToken,
	async (req, res) => {
		try {
			const { chatId } = req.params;
			const userId = req.user?.userId;
			const parsed = messageSchema.safeParse(req.body);
			if (!parsed.success || !userId) {
				return res.status(400).json({ error: "Contenido requerido" });
			}

			const { content } = parsed.data;

			const message = await prisma.message.create({
				data: {
					chatId,
					userId,
					content,
				},
				include: { user: true },
			});

			const chat = await prisma.chat.findUnique({
				where: { id: chatId },
				include: { participants: true },
			});

			if (chat && chat.type === "DIRECT") {
				const recipients = chat.participants.filter((p) => p.userId !== userId);
				for (const recipient of recipients) {
					await notify({
						userId: recipient.userId,
						type: "MESSAGE",
						title: "Nuevo Mensaje Directo",
						message: `${message.user.name} te ha enviado un mensaje`,
						entityType: "MESSAGE",
						entityId: message.id,
					});
				}
			}

			res.status(201).json({ data: message });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Error sending message" });
		}
	},
);

export default router;
