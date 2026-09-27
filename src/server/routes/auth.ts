import { randomUUID } from "node:crypto";
import bcryptjs from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import {
	AUTH_COOKIE_NAME,
	authenticateToken,
	JWT_AUDIENCE,
	JWT_ISSUER,
} from "../middleware/auth";
import { strongPasswordSchema } from "../validation/password";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
	throw new Error("JWT_SECRET environment variable is required");
}

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Hash dummy para igualar el tiempo de respuesta cuando el email no existe
const DUMMY_PASSWORD_HASH =
	"$2b$10$Aif6s5jywv/CTPHLyLCseud1Fv6JVY/FqB4geFmgTdMUzbTPv1ibG";

const registerSchema = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email(),
	password: strongPasswordSchema,
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
			const message = parsed.error.issues[0]?.message ?? "Datos inválidos";
			return res.status(400).json({ error: message });
		}

		const { name, email, password } = parsed.data;

		// El registro público siempre crea usuarios con rol TEAM_DEVELOPER.
		// Los roles privilegiados solo se asignan por un ADMIN via /api/users.

		// Verificar si el email ya existe
		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			// Ejecutar hashing dummy para igualar el tiempo de la respuesta
			// y no revelar si el email ya está registrado.
			await bcryptjs.hash("dummy-registration-timing", 10);
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
				role: "TEAM_DEVELOPER",
				active: true,
			},
			select: {
				id: true,
				email: true,
				name: true,
				role: true,
			},
		});

		res.status(201).json({
			message: "Usuario registrado exitosamente",
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

		// Comparar siempre contra un hash (dummy si el email no existe)
		// para evitar la enumeración de emails por timing.
		const passwordMatch = await bcryptjs.compare(
			password,
			user?.password ?? DUMMY_PASSWORD_HASH,
		);

		if (!user || !user.active || !passwordMatch) {
			return res.status(401).json({ error: "Email o contraseña incorrectos" });
		}

		// Generar JWT
		const token = jwt.sign(
			{
				userId: user.id,
				email: user.email,
				role: user.role,
				v: user.tokenVersion,
				iss: JWT_ISSUER,
				aud: JWT_AUDIENCE,
				jti: randomUUID(),
			},
			JWT_SECRET,
			{ algorithm: "HS256", expiresIn: "24h" },
		);

		res.cookie(AUTH_COOKIE_NAME, token, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			maxAge: TOKEN_MAX_AGE_MS,
			path: "/",
		});

		res.json({
			message: "Inicio de sesión exitoso",
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
		});
	} catch {
		console.error("Error al procesar la solicitud de inicio de sesión");
		res.status(500).json({ error: "Error al iniciar sesión" });
	}
});

// POST /api/auth/logout - Cerrar sesión
router.post("/logout", authenticateToken, async (req, res) => {
	try {
		if (!req.user) {
			res.status(401).json({ error: "No autorizado" });
			return;
		}
		const { userId } = req.user;

		// Incrementar tokenVersion invalida todos los tokens previos del usuario
		await prisma.user.update({
			where: { id: userId },
			data: { tokenVersion: { increment: 1 } },
		});

		res.clearCookie(AUTH_COOKIE_NAME, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
		});

		res.json({ message: "Sesión cerrada" });
	} catch {
		res.status(500).json({ error: "Error al cerrar la sesión" });
	}
});

export default router;
