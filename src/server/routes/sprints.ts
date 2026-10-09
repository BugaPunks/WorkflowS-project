import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { notify } from "../lib/notify";
import { authenticateToken } from "../middleware/auth";
import { requireProjectRole } from "../middleware/project-rbac";

const router = Router();

const sprintSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	projectId: z.string(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	status: z.string().optional(),
});

const sprintUpdateSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	description: z.string().max(2000).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	status: z.string().optional(),
});

// GET todos los sprints - any authenticated
router.get("/", authenticateToken, async (_req, res) => {
	try {
		const sprints = await prisma.sprint.findMany({
			include: {
				project: true,
				tasks: true,
				userStories: true,
				evaluations: true,
			},
		});
		res.json({ data: sprints });
	} catch (error) {
		console.error("Error al obtener sprints:", error);
		res.status(500).json({ error: "Error al obtener sprints" });
	}
});

// GET sprint por ID - any authenticated
router.get("/:id", authenticateToken, async (req, res) => {
	try {
		const sprint = await prisma.sprint.findUnique({
			where: { id: req.params.id },
			include: {
				project: true,
				tasks: true,
				userStories: true,
				evaluations: true,
			},
		});
		if (!sprint) return res.status(404).json({ error: "Sprint no encontrado" });
		res.json({ data: sprint });
	} catch (error) {
		console.error("Error al obtener sprint:", error);
		res.status(500).json({ error: "Error al obtener sprint" });
	}
});

// POST crear sprint - SCRUM_MASTER, PRODUCT_OWNER
router.post(
	"/",
	authenticateToken,
	requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"]),
	async (req, res) => {
		try {
			const parsed = sprintSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos inválidos" });
			}

			const { name, description, projectId, startDate, endDate, status } =
				parsed.data;

			const sprint = await prisma.sprint.create({
				data: {
					name,
					description,
					projectId,
					...(startDate && { startDate: new Date(startDate) }),
					...(endDate && { endDate: new Date(endDate) }),
					status: status || "PLANNING",
					// biome-ignore lint/suspicious/noExplicitAny: Prisma create data type is complex with optional fields
				} as any,
			});
			res.status(201).json({ data: sprint });
		} catch (error) {
			console.error("Error al crear sprint:", error);
			res.status(500).json({ error: "Error al crear sprint" });
		}
	},
);

// PUT actualizar sprint - SCRUM_MASTER, PRODUCT_OWNER
router.put(
	"/:id",
	authenticateToken,
	requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"], async (req) => {
		const sprint = await prisma.sprint.findUnique({
			where: { id: req.params.id },
		});
		return sprint?.projectId ?? null;
	}),
	async (req, res) => {
		try {
			const parsed = sprintUpdateSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos inválidos" });
			}
			const { name, description, startDate, endDate, status } = parsed.data;

			const existingSprint = await prisma.sprint.findUnique({
				where: { id: req.params.id },
				include: {
					project: {
						include: { members: true },
					},
				},
			});

			if (!existingSprint) {
				return res.status(404).json({ error: "Sprint no encontrado" });
			}

			const sprint = await prisma.sprint.update({
				where: { id: req.params.id },
				data: {
					...(name !== undefined && { name }),
					...(description !== undefined && { description }),
					...(startDate !== undefined && { startDate: new Date(startDate) }),
					...(endDate !== undefined && { endDate: new Date(endDate) }),
					...(status !== undefined && { status }),
				},
			});

			if (status === "COMPLETED" && existingSprint.status !== "COMPLETED") {
				const notifications = existingSprint.project.members.map((member) =>
					notify({
						userId: member.userId,
						type: "SPRINT_COMPLETED",
						title: "Sprint Completado",
						message: `El sprint "${sprint.name}" ha sido completado.`,
						entityType: "SPRINT",
						entityId: sprint.id,
					}),
				);
				if (notifications.length > 0) {
					await Promise.all(notifications);
				}
			}

			res.json({ data: sprint });
		} catch (error) {
			console.error("Error al actualizar sprint:", error);
			res.status(500).json({ error: "Error al actualizar sprint" });
		}
	},
);

// POST agregar historia de usuario a sprint - SCRUM_MASTER, PRODUCT_OWNER
router.post(
	"/:id/add-story",
	authenticateToken,
	requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"], async (req) => {
		const sprint = await prisma.sprint.findUnique({
			where: { id: req.params.id },
		});
		return sprint?.projectId ?? null;
	}),
	async (req, res) => {
		try {
			const { userStoryId } = req.body;
			const sprintId = req.params.id;

			if (!userStoryId) {
				return res.status(400).json({ error: "Falta userStoryId" });
			}

			const userStory = await prisma.userStory.findUnique({
				where: { id: userStoryId },
			});

			if (!userStory) {
				return res.status(404).json({ error: "Historia no encontrada" });
			}

			if (userStory.sprintId === sprintId) {
				return res
					.status(400)
					.json({ error: "La historia ya está en el sprint" });
			}

			const updatedStory = await prisma.userStory.update({
				where: { id: userStoryId },
				data: { sprintId },
			});

			res.status(201).json({ data: updatedStory });
		} catch (error) {
			console.error("Error al agregar historia al sprint:", error);
			res.status(500).json({ error: "Error al agregar historia al sprint" });
		}
	},
);

// DELETE quitar historia de un sprint - SCRUM_MASTER, PRODUCT_OWNER
router.delete(
	"/:id/stories/:storyId",
	authenticateToken,
	requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"], async (req) => {
		const sprint = await prisma.sprint.findUnique({
			where: { id: req.params.id },
		});
		return sprint?.projectId ?? null;
	}),
	async (req, res) => {
		try {
			const { storyId } = req.params;
			const sprintId = req.params.id;

			const userStory = await prisma.userStory.findUnique({
				where: { id: storyId },
			});

			if (!userStory) {
				return res.status(404).json({ error: "Historia no encontrada" });
			}

			if (userStory.sprintId !== sprintId) {
				return res
					.status(404)
					.json({ error: "La historia no pertenece a este sprint" });
			}

			const updatedStory = await prisma.userStory.update({
				where: { id: storyId },
				data: { sprintId: null },
			});

			res.json({ data: updatedStory });
		} catch (error) {
			console.error("Error al quitar historia del sprint:", error);
			res.status(500).json({ error: "Error al quitar historia del sprint" });
		}
	},
);

// DELETE sprint - SCRUM_MASTER, PRODUCT_OWNER
router.delete(
	"/:id",
	authenticateToken,
	requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"], async (req) => {
		const sprint = await prisma.sprint.findUnique({
			where: { id: req.params.id },
		});
		return sprint?.projectId ?? null;
	}),
	async (req, res) => {
		try {
			await prisma.sprint.delete({
				where: { id: req.params.id },
			});
			res.json({ data: { message: "Sprint eliminado" } });
		} catch (error) {
			console.error("Error al eliminar sprint:", error);
			res.status(500).json({ error: "Error al eliminar sprint" });
		}
	},
);

export default router;
