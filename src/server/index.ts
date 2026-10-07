import fs from "node:fs";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Express,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import "dotenv/config";

// Asegurar que existe el directorio de uploads
if (!fs.existsSync("uploads")) {
	fs.mkdirSync("uploads");
}

import { isPollingRequest } from "./lib/rate-limit";

// Importar rutas
import authRouter from "./routes/auth";
import chatRouter from "./routes/chat";
import documentsRouter from "./routes/documents";
import evaluationsRouter from "./routes/evaluations";
import filesRouter from "./routes/files";
import metricsRouter from "./routes/metrics";
import notificationPreferencesRouter from "./routes/notification-preferences";
import notificationsRouter from "./routes/notifications";
import projectsRouter from "./routes/projects";
import retrospectivesRouter from "./routes/retrospectives";
import rubricsRouter from "./routes/rubrics";
import sprintsRouter from "./routes/sprints";
import tasksRouter from "./routes/tasks";
import userStoriesRouter from "./routes/user-stories";
import usersRouter from "./routes/users";

const app: Express = express();
const PORT = process.env.API_PORT || 5000;

// Entorno derivado una sola vez al arrancar. El banner, la validación de
// secretos y cualquier otra decisión que dependa del entorno consultan esta
// bandera en lugar de leer NODE_ENV por separado (spec runtime-configuration).
const isProd = process.env.NODE_ENV === "production";

// Valor de ejemplo que entrega .env.example y longitud mínima aceptable en
// producción. Ambos valores son los que nadie cambiaría al desplegar, así que
// son exactamente los que el arranque de producción debe rechazar.
const EXAMPLE_JWT_SECRET = "your-super-secret-key-change-in-production";
const MIN_JWT_SECRET_LENGTH = 32;
const LOCAL_ORIGIN_PATTERN = /localhost|127\.0\.0\.1|\[::1\]/;

interface ConfigProblem {
	variable: string;
	problem: string;
}

const findProductionConfigProblems = (): ConfigProblem[] => {
	const problems: ConfigProblem[] = [];
	const secret = process.env.JWT_SECRET ?? "";

	if (secret.length === 0) {
		// También la cubre el throw de ./middleware/auth al importar, pero se
		// repite aquí para que el error de producción nombre la variable.
		problems.push({
			variable: "JWT_SECRET",
			problem: "no está definida",
		});
	} else if (secret === EXAMPLE_JWT_SECRET) {
		problems.push({
			variable: "JWT_SECRET",
			problem: `sigue siendo el valor de ejemplo de .env.example ("${EXAMPLE_JWT_SECRET}")`,
		});
	} else if (secret.length < MIN_JWT_SECRET_LENGTH) {
		problems.push({
			variable: "JWT_SECRET",
			problem: `mide ${secret.length} caracteres y exige al menos ${MIN_JWT_SECRET_LENGTH}`,
		});
	}

	for (const origin of corsOrigins) {
		if (LOCAL_ORIGIN_PATTERN.test(origin)) {
			problems.push({
				variable: "CORS_ORIGINS",
				problem: `incluye el origen local "${origin}", que no debe exponerse en producción`,
			});
		}
	}

	return problems;
};

// Security headers
app.use(helmet());

// Parseo de cookies para leer el token de sesión
app.use(cookieParser());

// CORS configuration (con credenciales para cookies)
const corsOrigins = process.env.CORS_ORIGINS?.split(",") || [
	"http://localhost:3000",
];
app.use(cors({ origin: corsOrigins, credentials: true }));

// Protección CSRF: rechaza mutaciones cuyo Origin/Referer no esté en CORS_ORIGINS
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfProtection = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	if (!CSRF_METHODS.has(req.method)) {
		next();
		return;
	}
	const rawOrigin = req.headers.origin || req.headers.referer;
	if (!rawOrigin) {
		next();
		return;
	}
	const origin = new URL(rawOrigin).origin;
	if (!corsOrigins.includes(origin)) {
		res.status(403).json({ error: "Origen no permitido" });
		return;
	}
	next();
};

const disableRateLimit =
	process.env.DISABLE_RATE_LIMIT === "true" || process.env.NODE_ENV === "test";

const positiveIntFromEnv = (
	value: string | undefined,
	fallback: number,
): number => {
	if (value === undefined || value.trim() === "") {
		return fallback;
	}
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}
	return parsed;
};

const apiRateLimitMax = positiveIntFromEnv(
	process.env.API_RATE_LIMIT_MAX,
	1000,
);
const apiRateLimitWindowMs = positiveIntFromEnv(
	process.env.API_RATE_LIMIT_WINDOW_MS,
	900000,
);

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	skip: () => disableRateLimit,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Demasiados intentos, intenta de nuevo más tarde" },
});

const registerLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 10,
	skip: () => disableRateLimit,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		error: "Demasiados intentos de registro, intenta de nuevo más tarde",
	},
});

const apiLimiter = rateLimit({
	windowMs: apiRateLimitWindowMs,
	max: apiRateLimitMax,
	skip: (req) => disableRateLimit || isPollingRequest(req),
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Demasiadas solicitudes, intenta de nuevo más tarde" },
});

app.use(express.json());

// Apply rate limiters
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api", apiLimiter);

// Protección CSRF antes de las rutas API
app.use("/api", csrfProtection);

// Rutas API
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/sprints", sprintsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/user-stories", userStoriesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/files", filesRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/evaluations", evaluationsRouter);
app.use("/api/rubrics", rubricsRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/notification-preferences", notificationPreferencesRouter);
app.use("/api/retrospectives", retrospectivesRouter);

// Health check
app.get("/api/health", (_req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling para rutas no encontradas
app.use((_req, res) => {
	res.status(404).json({ error: "Ruta no encontrada" });
});

// En producción se falla rápido antes de aceptar tráfico: una configuración
// insegura es un fallo ruidoso, no un despliegue silencioso.
if (isProd) {
	const problems = findProductionConfigProblems();
	if (problems.length > 0) {
		for (const problem of problems) {
			console.error(
				`✖ Configuración de producción insegura — ${problem.variable}: ${problem.problem}`,
			);
		}
		console.error(
			"El servidor no arranca con una configuración insegura. Consulta .env.example.",
		);
		process.exit(1);
	}
}

// Iniciar servidor
const server = app.listen(PORT, () => {
	console.info(
		`🚀 API Server corriendo en http://localhost:${PORT} — entorno: ${isProd ? "PRODUCCIÓN" : "DESARROLLO"} (VERSION 2 - SECURED)`,
	);
});

// Node cierra las conexiones keep-alive a los 5s por defecto. Los clientes que
// reutilizan el socket (p. ej. el APIRequestContext de Playwright) llegan al
// siguiente request con una conexión ya cerrada y la escritura falla con
// ECONNRESET. Se alinean los timeouts con los del proxy (60s) para evitarlo.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

export default server;
