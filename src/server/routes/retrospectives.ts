import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireProjectRole } from "../middleware/project-rbac";

const router = Router();

const retroItemSchema = z.object({
	sprintId: z.string(),
	type: z.string().min(1),
	content: z.string().min(1).max(2000),
	userId: z.string(),
});

// GET items de retrospectiva por sprint - any project member
router.get(
	"/:sprintId",
	authenticateToken,
	requireProjectRole(
		["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"],
		async (req) => {
			const sprint = await prisma.sprint.findUnique({
				where: { id: req.params.sprintId },
			});
			return sprint?.projectId ?? null;
		},
	),
	async (req, res) => {
		try {
			const { sprintId } = req.params;
			const items = await prisma.retrospectiveItem.findMany({
				where: { sprintId },
				include: {
					user: {
						select: { id: true, name: true, avatar: true },
					},
				},
				orderBy: { createdAt: "asc" },
			});
			res.json({ data: items });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Error al obtener retrospectiva" });
		}
	},
);

// POST crear item - any project member
router.post(
	"/",
	authenticateToken,
	requireProjectRole(
		["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"],
		async (req) => {
			const sprint = await prisma.sprint.findUnique({
				where: { id: req.body.sprintId },
			});
			return sprint?.projectId ?? null;
		},
	),
	async (req, res) => {
		try {
			const parsed = retroItemSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos incompletos" });
			}

			const { sprintId, type, content, userId } = parsed.data;

			const item = await prisma.retrospectiveItem.create({
				data: {
					sprintId,
					type,
					content,
					userId,
				},
				include: {
					user: {
						select: { id: true, name: true, avatar: true },
					},
					sprint: {
						include: {
							project: {
								include: {
									members: true,
								},
							},
						},
					},
				},
			});

			const projectMembers = item.sprint.project.members;
			const notifications = projectMembers
				.filter((member) => member.userId !== userId)
				.map((member) => ({
					userId: member.userId,
					title: "Nueva Nota en Retrospectiva",
					message: `Se ha añadido una nota "${type}" en el sprint ${item.sprint.name}`,
					type: "RETROSPECTIVE_ITEM",
				}));

			if (notifications.length > 0) {
				await prisma.notification.createMany({
					data: notifications,
				});
			}

			res.status(201).json({ data: item });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Error al crear item" });
		}
	},
);

// DELETE item - any project member
router.delete(
	"/:id",
	authenticateToken,
	requireProjectRole(
		["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"],
		async (req) => {
			const item = await prisma.retrospectiveItem.findUnique({
				where: { id: req.params.id },
				include: { sprint: true },
			});
			return item?.sprint?.projectId ?? null;
		},
	),
	async (req, res) => {
		try {
			await prisma.retrospectiveItem.delete({
				where: { id: req.params.id },
			});
			res.json({ message: "Item eliminado" });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Error al eliminar item" });
		}
	},
);

export default router;
