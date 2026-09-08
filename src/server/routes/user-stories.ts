import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireProjectRole } from "../middleware/project-rbac";
import { requireSystemRole } from "../middleware/system-rbac";

const router = Router();

const userStoryCreateSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	acceptance: z.string().max(2000).optional(),
	projectId: z.string(),
	assigneeId: z.string().optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
	storyPoints: z.number().optional(),
});

const userStoryUpdateSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	description: z.string().max(2000).optional(),
	acceptance: z.string().max(2000).optional(),
	assigneeId: z.string().optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
	storyPoints: z.number().optional(),
	status: z.string().optional(),
});

// GET todos los User Stories - any authenticated
router.get("/", authenticateToken, async (_req, res) => {
	try {
		const userStories = await prisma.userStory.findMany({
			include: {
				project: {
					select: { id: true, name: true },
				},
				assignee: {
					select: { id: true, name: true, email: true },
				},
			},
		});
		res.json({ data: userStories });
	} catch {
		res.status(500).json({ error: "Error al obtener user stories" });
	}
});

// GET user story por ID - any authenticated
router.get("/:id", authenticateToken, async (req, res) => {
	try {
		const userStory = await prisma.userStory.findUnique({
			where: { id: req.params.id },
			include: {
				project: {
					select: { id: true, name: true },
				},
				assignee: {
					select: { id: true, name: true, email: true },
				},
				tasks: true,
			},
		});
		if (!userStory)
			return res.status(404).json({ error: "User story no encontrado" });
		res.json({ data: userStory });
	} catch {
		res.status(500).json({ error: "Error al obtener user story" });
	}
});

// POST crear user story - PRODUCT_OWNER, SCRUM_MASTER
router.post(
	"/",
	authenticateToken,
	requireProjectRole(["PRODUCT_OWNER", "SCRUM_MASTER"]),
	async (req, res) => {
		try {
			const parsed = userStoryCreateSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos inválidos" });
			}

			const {
				title,
				description,
				acceptance,
				projectId,
				assigneeId,
				priority,
				storyPoints,
			} = parsed.data;

			const userStory = await prisma.userStory.create({
				data: {
					title,
					...(description !== undefined && { description }),
					...(acceptance !== undefined && { acceptance }),
					projectId,
					...(assigneeId !== undefined && { assigneeId }),
					priority: priority || "MEDIUM",
					...(storyPoints !== undefined && { storyPoints }),
					// biome-ignore lint/suspicious/noExplicitAny: Prisma create data type is complex with optional fields
				} as any,
			});
			res.status(201).json({ data: userStory });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Error al crear user story" });
		}
	},
);

// PUT actualizar user story - PRODUCT_OWNER, SCRUM_MASTER
router.put(
	"/:id",
	authenticateToken,
	requireProjectRole(["PRODUCT_OWNER", "SCRUM_MASTER"], async (req) => {
		const us = await prisma.userStory.findUnique({
			where: { id: req.params.id },
		});
		return us?.projectId ?? null;
	}),
	async (req, res) => {
		try {
			const parsed = userStoryUpdateSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos inválidos" });
			}
			const {
				title,
				description,
				acceptance,
				assigneeId,
				priority,
				storyPoints,
				status,
			} = parsed.data;

			const dataToUpdate: Record<string, unknown> = {
				...(title !== undefined && { title }),
				...(description !== undefined && { description }),
				...(acceptance !== undefined && { acceptance }),
				...(assigneeId !== undefined && { assigneeId }),
				...(priority !== undefined && { priority }),
				...(storyPoints !== undefined && { storyPoints }),
			};

			if (status) {
				dataToUpdate.status = status;
				if (status === "COMPLETED" || status === "DONE") {
					dataToUpdate.completedAt = new Date();
				} else if (status === "BACKLOG" || status === "TODO") {
					dataToUpdate.completedAt = null;
				}
			}

			const previousStory = await prisma.userStory.findUnique({
				where: { id: req.params.id },
				select: { assigneeId: true },
			});

			const userStory = await prisma.userStory.update({
				where: { id: req.params.id },
				data: dataToUpdate,
				include: { project: { select: { name: true } } },
			});

			if (
				dataToUpdate.assigneeId &&
				dataToUpdate.assigneeId !== previousStory?.assigneeId
			) {
				await prisma.notification.create({
					data: {
						userId: dataToUpdate.assigneeId as string,
						title: "Historia de Usuario Asignada",
						message: `Se te ha asignado la historia "${userStory.title}" en el proyecto ${userStory.project.name}`,
						type: "TASK_ASSIGNED",
					},
				});
			}

			res.json({ data: userStory });
		} catch {
			res.status(500).json({ error: "Error al actualizar user story" });
		}
	},
);

// DELETE user story - ADMIN only
router.delete(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			await prisma.userStory.delete({
				where: { id: req.params.id },
			});
			res.json({ message: "User story eliminado" });
		} catch {
			res.status(500).json({ error: "Error al eliminar user story" });
		}
	},
);

export default router;
