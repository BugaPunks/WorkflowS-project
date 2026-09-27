import { z } from "zod";

const COMMON_PASSWORDS = new Set([
	"password",
	"password1",
	"password123",
	"12345678",
	"123456789",
	"1234567890",
	"qwerty",
	"qwerty123",
	"abc12345",
	"iloveyou",
	"admin",
	"admin123",
	"letmein",
	"welcome",
	"monkey",
	"dragon",
]);

const passwordBase = z
	.string()
	.min(8, "La contraseña debe tener al menos 8 caracteres")
	.max(72, "La contraseña no puede exceder 72 caracteres")
	.regex(/[A-Z]/, "La contraseña debe incluir al menos una letra mayúscula")
	.regex(/[a-z]/, "La contraseña debe incluir al menos una letra minúscula")
	.regex(/[0-9]/, "La contraseña debe incluir al menos un número");

export const strongPasswordSchema = passwordBase.refine(
	(password) => !COMMON_PASSWORDS.has(password.toLowerCase()),
	{ message: "La contraseña es demasiado común", path: ["password"] },
);
