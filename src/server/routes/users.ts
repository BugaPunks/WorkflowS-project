import bcryptjs from "bcryptjs";
import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireSystemRole } from "../middleware/system-rbac";

const router = Router();

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

// POST crear usuario - ADMIN only
router.post(
	"/",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { email, name, password, role } = req.body;

			if (!email || !name || !password) {
				return res.status(400).json({ error: "Faltan campos requeridos" });
			}

			const hashedPassword = await bcryptjs.hash(password, 10);

			const user = await prisma.user.create({
				data: {
					email,
					name,
					password: hashedPassword,
					role: role || "TEAM_DEVELOPER",
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
