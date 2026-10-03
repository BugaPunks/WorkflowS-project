import bcryptjs from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireSystemRole } from "../middleware/system-rbac";
import { strongPasswordSchema } from "../validation/password";

const router = Router();

const createUserSchema = z.object({
	email: z.string().email("El email no es válido"),
	name: z.string().min(1, "El nombre es requerido").max(100),
	password: strongPasswordSchema,
	role: z
		.enum(["ADMIN", "PRODUCT_OWNER", "SCRUM_MASTER", "TEAM_DEVELOPER"])
		.optional()
		.default("TEAM_DEVELOPER"),
});

// GET todos los usuarios - ADMIN only
router.get(
	"/",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (_req, res) => {
		try {
			const users = await prisma.user.findMany({
				select: {
					id: true,
					email: true,
					name: true,
					role: true,
					active: true,
					createdAt: true,
				},
			});
			res.json({ data: users });
		} catch {
			res.status(500).json({ error: "Error al obtener usuarios" });
		}
	},
);

// GET usuario por ID - ADMIN only
router.get(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const user = await prisma.user.findUnique({
				where: { id: req.params.id },
				select: {
					id: true,
					email: true,
					name: true,
					role: true,
					active: true,
					createdAt: true,
					dashboardModules: true,
					projects: true,
					tasks: true,
				},
			});
			if (!user)
				return res.status(404).json({ error: "Usuario no encontrado" });
			res.json({ data: user });
		} catch {
			res.status(500).json({ error: "Error al obtener usuario" });
		}
	},
);

// GET /api/users/:id/dashboard-summary - Self or ADMIN
router.get("/:id/dashboard-summary", authenticateToken, async (req, res) => {
	try {
		if (req.user!.userId !== req.params.id && req.user!.role !== "ADMIN") {
			return res.sendStatus(403);
		}

		const user = await prisma.user.findUnique({
			where: { id: req.params.id },
			include: {
				tasks: true,
				projects: true,
				projectMemberships: {
					include: {
						project: {
							include: { tasks: true },
						},
					},
				},
			},
		});

		if (!user) return res.status(404).json({ error: "No encontrado" });

		let activeTasks = 0;
		let totalItems = 0;

		if (user.role === "TEAM_DEVELOPER") {
			activeTasks = user.tasks.filter((t) => t.status !== "COMPLETED").length;
			totalItems = user.tasks.length;
		} else if (user.role === "PRODUCT_OWNER" || user.role === "SCRUM_MASTER") {
			// totalItems = total projects they are member of or own
			const projects = user.projectMemberships.map((m) => m.project);
			totalItems = projects.length;
			// activeTasks = total pending tasks in those projects
			activeTasks = projects.reduce(
				(acc, p) =>
					acc + p.tasks.filter((t) => t.status !== "COMPLETED").length,
				0,
			);
		}

		res.json({
			activeTasks,
			totalItems,
			dashboardModules: user.dashboardModules
				? JSON.parse(user.dashboardModules)
				: null,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Error" });
	}
});

// PUT /api/users/:id/dashboard - Self or ADMIN
router.put("/:id/dashboard", authenticateToken, async (req, res) => {
	try {
		if (req.user!.userId !== req.params.id && req.user!.role !== "ADMIN") {
			return res.sendStatus(403);
		}

		const modules = req.body.modules;
		if (!Array.isArray(modules)) {
			return res.status(400).json({ error: "modules debe ser un array" });
		}

		await prisma.user.update({
			where: { id: req.params.id },
			data: { dashboardModules: JSON.stringify(modules) },
		});
		res.json({ message: "Dashboard actualizado" });
	} catch {
		res.status(500).json({ error: "Error al actualizar dashboard" });
	}
});

// POST crear usuario - ADMIN only
router.post(
	"/",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const parsed = createUserSchema.safeParse(req.body);
			if (!parsed.success) {
				const message =
					parsed.error.issues[0]?.message ?? "Faltan campos requeridos";
				return res.status(400).json({ error: message });
			}

			const { email, name, password, role } = parsed.data;

			const hashedPassword = await bcryptjs.hash(password, 10);

			const user = await prisma.user.create({
				data: {
					email,
					name,
					password: hashedPassword,
					role,
				},
				select: {
					id: true,
					email: true,
					name: true,
					role: true,
					active: true,
				},
			});
			res.status(201).json({ data: user });
		} catch (error) {
			const err = error as { code?: string };
			if (err.code === "P2002") {
				return res.status(400).json({ error: "Email ya existe" });
			}
			res.status(500).json({ error: "Error al crear usuario" });
		}
	},
);

// PUT actualizar usuario - ADMIN only
router.put(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { name, email, role, active } = req.body;

			const user = await prisma.user.update({
				where: { id },
				data: {
					...(name !== undefined && { name }),
					...(email !== undefined && { email }),
					...(role !== undefined && { role }),
					...(active !== undefined && { active }),
					// Si se desactiva al usuario, invalidar todos sus tokens
					...(active === false && { tokenVersion: { increment: 1 } }),
				},
				select: {
					id: true,
					email: true,
					name: true,
					role: true,
					active: true,
				},
			});
			res.json({ data: user });
		} catch {
			res.status(500).json({ error: "Error al actualizar usuario" });
		}
	},
);

// DELETE usuario - ADMIN only
router.delete(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			await prisma.user.delete({
				where: { id: req.params.id },
			});
			res.json({ data: { message: "Usuario eliminado" } });
		} catch {
			res.status(500).json({ error: "Error al eliminar usuario" });
		}
	},
);

export default router;
