import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireSystemRole } from "../middleware/system-rbac";

const router = Router();

const projectSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	ownerId: z.string(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

const projectUpdateSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	description: z.string().max(2000).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

const memberSchema = z.object({
	userId: z.string(),
	role: z.enum(["SCRUM_MASTER", "PRODUCT_OWNER", "TEAM_DEVELOPER"]),
});

// GET todos los proyectos - any authenticated user
router.get("/", authenticateToken, async (req, res) => {
	try {
		const { memberId } = req.query;
		const whereClause = memberId
			? {
					OR: [
						{ ownerId: String(memberId) },
						{ members: { some: { userId: String(memberId) } } },
					],
				}
			: {};

		const projects = await prisma.project.findMany({
			where: whereClause,
			include: {
				owner: {
					select: { id: true, name: true, email: true },
				},
				members: true,
				sprints: true,
			},
		});
		res.json(projects);
	} catch (error) {
		console.error("Error al obtener proyectos:", error);
		res.status(500).json({ error: "Error al obtener proyectos" });
	}
});

// GET proyecto por ID - any authenticated user
router.get("/:id", authenticateToken, async (req, res) => {
	try {
		const project = await prisma.project.findUnique({
			where: { id: req.params.id },
			include: {
				owner: {
					select: { id: true, name: true, email: true },
				},
				members: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								role: true,
								avatar: true,
							},
						},
					},
				},
				sprints: true,
				userStories: true,
				tasks: true,
			},
		});
		if (!project)
			return res.status(404).json({ error: "Proyecto no encontrado" });
		res.json({ data: project });
	} catch (error) {
		console.error("Error al obtener proyecto:", error);
		res.status(500).json({ error: "Error al obtener proyecto" });
	}
});

// POST crear proyecto - ADMIN only
router.post(
	"/",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const parsed = projectSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos inválidos" });
			}

			const { name, description, ownerId, startDate, endDate } = parsed.data;

			const project = await prisma.project.create({
				data: {
					name,
					description,
					ownerId,
					startDate: startDate ? new Date(startDate) : undefined,
					endDate: endDate ? new Date(endDate) : undefined,
				},
			});
			res.status(201).json({ data: project });
		} catch (error) {
			console.error("Error al crear proyecto:", error);
			res.status(500).json({ error: "Error al crear proyecto" });
		}
	},
);

// PUT actualizar proyecto - ADMIN only
router.put(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const parsed = projectUpdateSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos inválidos" });
			}
			const { name, description, startDate, endDate } = parsed.data;

			const project = await prisma.project.update({
				where: { id: req.params.id },
				data: {
					...(name !== undefined && { name }),
					...(description !== undefined && { description }),
					...(startDate !== undefined && { startDate: new Date(startDate) }),
					...(endDate !== undefined && { endDate: new Date(endDate) }),
				},
			});
			res.json({ data: project });
		} catch (error) {
			console.error("Error al actualizar proyecto:", error);
			res.status(500).json({ error: "Error al actualizar proyecto" });
		}
	},
);

// POST asignar miembro a proyecto - ADMIN only
router.post(
	"/:id/members",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const projectId = req.params.id;
			const parsed = memberSchema.safeParse(req.body);
			if (!parsed.success) {
				return res
					.status(400)
					.json({ error: "Datos inválidos: userId y role requeridos" });
			}

			const { userId, role } = parsed.data;

			// Check if already member
			const existingMember = await prisma.projectMember.findUnique({
				where: {
					projectId_userId: {
						projectId,
						userId,
					},
				},
			});

			if (existingMember) {
				// Update role if exists
				const updatedMember = await prisma.projectMember.update({
					where: { id: existingMember.id },
					data: { role },
				});
				return res.json({ data: updatedMember, message: "Rol actualizado" });
			}

			const member = await prisma.projectMember.create({
				data: {
					projectId,
					userId,
					role,
				},
				include: {
					project: { select: { name: true } },
				},
			});

			// Notificar al usuario
			await prisma.notification.create({
				data: {
					userId,
					title: "Nuevo Proyecto Asignado",
					message: `Has sido añadido al proyecto "${member.project.name}" como ${role}`,
					type: "PROJECT_ASSIGNED",
				},
			});

			res.status(201).json({ data: member });
		} catch (error) {
			console.error("Error al asignar miembro:", error);
			res.status(500).json({ error: "Error al asignar miembro" });
		}
	},
);

// DELETE eliminar miembro de proyecto - ADMIN only
router.delete(
	"/:id/members/:userId",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { id: projectId, userId } = req.params;
			await prisma.projectMember.delete({
				where: {
					projectId_userId: {
						projectId,
						userId,
					},
				},
			});
			res.json({ message: "Miembro eliminado del proyecto" });
		} catch (error) {
			console.error("Error al eliminar miembro:", error);
			res.status(500).json({ error: "Error al eliminar miembro" });
		}
	},
);

// DELETE proyecto - ADMIN only
router.delete(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			await prisma.project.delete({
				where: { id: req.params.id },
			});
			res.json({ data: { message: "Proyecto eliminado" } });
		} catch (error) {
			console.error("Error al eliminar proyecto:", error);
			res.status(500).json({ error: "Error al eliminar proyecto" });
		}
	},
);

export default router;
