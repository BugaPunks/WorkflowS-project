import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const { prisma, __resetPrisma } = vi.hoisted(() => {
	// JWT_SECRET se define AQUÍ porque vi.hoisted se ejecuta antes que cualquier
	// import: el middleware real de auth (auth.ts) lanza al importarse sin ella.
	process.env.JWT_SECRET = "test-secret-key-0123456789abcdef-0123456789";
	const prisma = {
		user: { findUnique: vi.fn() },
		projectMember: { findUnique: vi.fn() },
		task: { findUnique: vi.fn(), delete: vi.fn() },
	};
	return {
		prisma,
		__resetPrisma: () => {
			for (const delegate of Object.values(prisma)) {
				for (const fn of Object.values(delegate)) {
					fn.mockReset();
				}
			}
		},
	};
});

// Aislar la capa de datos: solo se mockea prisma; los middlewares auth y
// project-rbac se ejecutan REALES contra estos mocks.
vi.mock("../db", () => ({ prisma, default: prisma }));

import { JWT_AUDIENCE, JWT_ISSUER } from "../middleware/auth";
import tasksRouter from "./tasks";

const TEST_JWT_SECRET =
	process.env.JWT_SECRET ?? "test-secret-key-0123456789abcdef-0123456789";

const PROJECT_ID = "proj-1";
const TASK_ID = "task-1";
const USER_ID = "user-1";

const baseTask = {
	id: TASK_ID,
	projectId: PROJECT_ID,
	title: "Tarea de prueba",
	description: "desc",
	status: "TODO",
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use("/api/tasks", tasksRouter);
	await new Promise<void>((resolve) => {
		server = app.listen(0, () => resolve());
	});
	const address = server.address();
	if (address && typeof address === "object") {
		baseUrl = `http://127.0.0.1:${address.port}`;
	}
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) =>
		server.close((err) => (err ? reject(err) : resolve())),
	);
});

const signToken = (role: string, userId: string = USER_ID): string =>
	jwt.sign({ userId, email: "test@example.com", role, v: 0 }, TEST_JWT_SECRET, {
		algorithm: "HS256",
		issuer: JWT_ISSUER,
		audience: JWT_AUDIENCE,
	});

const callDelete = (
	taskId: string = TASK_ID,
	role: string = "PRODUCT_OWNER",
	userId: string = USER_ID,
): Promise<Response> =>
	fetch(`${baseUrl}/api/tasks/${taskId}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${signToken(role, userId)}` },
	});

const mockUser = (role: string) =>
	prisma.user.findUnique.mockResolvedValue({
		id: USER_ID,
		email: "test@example.com",
		role,
		active: true,
		tokenVersion: 0,
	});

const mockMembership = (role: string | null) =>
	prisma.projectMember.findUnique.mockResolvedValue(
		role ? { id: "m-1", projectId: PROJECT_ID, userId: USER_ID, role } : null,
	);

const mockTask = (task: unknown) =>
	prisma.task.findUnique.mockResolvedValue(task);

const mockDelete = () =>
	prisma.task.delete.mockImplementation(async () => ({ ...baseTask }));

beforeEach(() => {
	__resetPrisma();
	// Estado feliz por defecto
	mockUser("PRODUCT_OWNER");
	mockMembership("PRODUCT_OWNER");
	mockTask({ ...baseTask });
	mockDelete();
});

describe("DELETE /api/tasks/:id — autorización", () => {
	it("401 sin token", async () => {
		const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
			method: "DELETE",
		});
		expect(res.status).toBe(401);
		expect(prisma.task.delete).not.toHaveBeenCalled();
	});

	it("403 para TEAM_DEVELOPER", async () => {
		mockUser("USER");
		mockMembership("TEAM_DEVELOPER");
		const res = await callDelete();
		expect(res.status).toBe(403);
		expect(prisma.task.delete).not.toHaveBeenCalled();
	});

	it("403 sin membresía en el proyecto", async () => {
		mockUser("USER");
		mockMembership(null);
		const res = await callDelete();
		expect(res.status).toBe(403);
		expect(prisma.task.delete).not.toHaveBeenCalled();
	});

	it("200 para PRODUCT_OWNER", async () => {
		mockUser("PRODUCT_OWNER");
		mockMembership("PRODUCT_OWNER");
		const res = await callDelete();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.message).toBe("Tarea eliminada");
	});

	it("200 para SCRUM_MASTER", async () => {
		mockUser("SCRUM_MASTER");
		mockMembership("SCRUM_MASTER");
		const res = await callDelete();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.message).toBe("Tarea eliminada");
	});

	it("200 para ADMIN sin ser miembro (bypass)", async () => {
		mockUser("ADMIN");
		mockMembership(null);
		const res = await callDelete();
		expect(res.status).toBe(200);
		expect(prisma.task.delete).toHaveBeenCalled();
	});

	it("400 si la tarea no existe (projectId required)", async () => {
		mockTask(null);
		const res = await callDelete();
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("projectId required");
		expect(prisma.task.delete).not.toHaveBeenCalled();
	});
});

describe("DELETE /api/tasks/:id — handler", () => {
	it("200 y delete llamado con { where: { id } }", async () => {
		const res = await callDelete();
		expect(res.status).toBe(200);
		expect(prisma.task.delete).toHaveBeenCalledWith({
			where: { id: TASK_ID },
		});
	});

	it("500 si delete falla (respuesta con error)", async () => {
		mockUser("PRODUCT_OWNER");
		mockMembership("PRODUCT_OWNER");
		prisma.task.delete.mockRejectedValue(new Error("boom"));
		const res = await callDelete();
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Error al eliminar tarea");
	});
});
