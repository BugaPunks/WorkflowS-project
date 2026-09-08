import fs from "node:fs";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import "dotenv/config";

// Asegurar que existe el directorio de uploads
if (!fs.existsSync("uploads")) {
	fs.mkdirSync("uploads");
}

// Importar rutas
import authRouter from "./routes/auth";
import chatRouter from "./routes/chat";
import documentsRouter from "./routes/documents";
import evaluationsRouter from "./routes/evaluations";
import filesRouter from "./routes/files";
import metricsRouter from "./routes/metrics";
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

// Security headers
app.use(helmet());

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(",") || [
	"http://localhost:3000",
];
app.use(cors({ origin: corsOrigins }));

const disableRateLimit =
	process.env.DISABLE_RATE_LIMIT === "true" || process.env.NODE_ENV === "test";

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
	windowMs: 15 * 60 * 1000,
	max: 100,
	skip: () => disableRateLimit,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Demasiadas solicitudes, intenta de nuevo más tarde" },
});

app.use(express.json());

// Apply rate limiters
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api", apiLimiter);

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
app.use("/api/retrospectives", retrospectivesRouter);

// Health check
app.get("/api/health", (_req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling para rutas no encontradas
app.use((_req, res) => {
	res.status(404).json({ error: "Ruta no encontrada" });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
	console.log(
		`🚀 API Server corriendo en http://localhost:${PORT} (VERSION 2 - SECURED)`,
	);
});

export default server;
