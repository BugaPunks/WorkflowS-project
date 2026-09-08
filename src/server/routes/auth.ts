import bcryptjs from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
	throw new Error("JWT_SECRET environment variable is required");
}

const registerSchema = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email(),
	password: z.string().min(6),
	role: z
		.enum(["ADMIN", "PRODUCT_OWNER", "SCRUM_MASTER", "TEAM_DEVELOPER"])
		.optional()
		.default("TEAM_DEVELOPER"),
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

// POST /api/auth/register - Registrar nuevo usuario
router.post("/register", async (req, res) => {
	try {
		const parsed = registerSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ error: "Datos inválidos" });
		}

		const { name, email, password, role } = parsed.data;

		// Solo permitir registro con rol ADMIN en modo test o con flag
		if (role === "ADMIN" && process.env.NODE_ENV !== "test" && process.env.DISABLE_RATE_LIMIT !== "true") {
			return res.status(403).json({
				error: "No autorizado. Contacte al administrador del sistema.",
			});
		}

		// Verificar si el email ya existe
		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			return res.status(400).json({ error: "El email ya está registrado" });
		}

		// Hashear contraseña
		const hashedPassword = await bcryptjs.hash(password, 10);

		// Crear usuario
		const user = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role,
				active: true,
			},
			select: {
				id: true,
				email: true,
				name: true,
				role: true,
			},
		});

		const token = jwt.sign(
			{
				userId: user.id,
				email: user.email,
				role: user.role,
			},
			JWT_SECRET,
			{ expiresIn: "24h" },
		);

		res.status(201).json({
			message: "Usuario registrado exitosamente",
			token,
			user,
		});
	} catch (error) {
		const err = error as { code?: string; message?: string };
		if (err.code === "P2002") {
			return res.status(400).json({ error: "El email ya está registrado" });
		}
		res.status(500).json({ error: "Error al registrar usuario" });
	}
});

// POST /api/auth/login - Iniciar sesión
router.post("/login", async (req, res) => {
	try {
		const parsed = loginSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ error: "Email y contraseña requeridos" });
		}

		const { email, password } = parsed.data;

		// Buscar usuario por email
		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			return res.status(401).json({ error: "Email o contraseña incorrectos" });
		}

		// Verificar contraseña
		const passwordMatch = await bcryptjs.compare(password, user.password);

		if (!passwordMatch) {
			return res.status(401).json({ error: "Email o contraseña incorrectos" });
		}

		// Verificar si el usuario está activo
		if (!user.active) {
			return res.status(403).json({ error: "Usuario desactivado" });
		}

		// Generar JWT
		const token = jwt.sign(
			{
				userId: user.id,
				email: user.email,
				role: user.role,
			},
			JWT_SECRET,
			{ expiresIn: "24h" },
		);

		res.json({
			message: "Inicio de sesión exitoso",
			token,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
		});
	} catch (error) {
		console.error("Error en login:", error);
		res.status(500).json({ error: "Error al iniciar sesión" });
	}
});

// POST /api/auth/logout - Cerrar sesión
router.post("/logout", authenticateToken, (_req, res) => {
	res.json({ message: "Sesión cerrada" });
});

export default router;
