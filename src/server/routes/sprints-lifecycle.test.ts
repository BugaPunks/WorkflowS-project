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

const { prisma, notifyMock, __resetPrisma, __resetNotify } = vi.hoisted(() => {
	// JWT_SECRET se define AQUÍ porque vi.hoisted se ejecuta antes que cualquier
	// import: el middleware real de auth (auth.ts) lanza al importarse sin ella.
	process.env.JWT_SECRET = "test-secret-key-0123456789abcdef-0123456789";
	const prisma = {
		user: { findUnique: vi.fn() },
		sprint: { findUnique: vi.fn(), update: vi.fn() },
		projectMember: { findUnique: vi.fn() },
	};
	const notifyMock = vi.fn();
	return {
		prisma,
		notifyMock,
		__resetPrisma: () => {
			for (const delegate of Object.values(prisma)) {
				for (const fn of Object.values(delegate)) {
					fn.mockReset();
				}
			}
		},
		__resetNotify: () => notifyMock.mockReset(),
	};
});

// Aislar la capa de datos y las notificaciones: los middlewares auth y
// project-rbac se ejecutan REALES contra estos mocks.
vi.mock("../db", () => ({ prisma, default: prisma }));
vi.mock("../lib/notify", () => ({ notify: notifyMock }));

import { JWT_AUDIENCE, JWT_ISSUER } from "../middleware/auth";
import sprintsRouter from "./sprints";

const TEST_JWT_SECRET =
	process.env.JWT_SECRET ?? "test-secret-key-0123456789abcdef-0123456789";

const PROJECT_ID = "proj-1";
const SPRINT_ID = "sprint-1";
const USER_ID = "user-1";

const MEMBERS = [
	{ id: "m-1", projectId: PROJECT_ID, userId: "user-1", role: "SCRUM_MASTER" },
	{
		id: "m-2",
		projectId: PROJECT_ID,
		userId: "user-2",
		role: "TEAM_DEVELOPER",
	},
	{ id: "m-3", projectId: PROJECT_ID, userId: "user-3", role: "PRODUCT_OWNER" },
	{
		id: "m-4",
		projectId: PROJECT_ID,
		userId: "user-4",
		role: "TEAM_DEVELOPER",
	},
];

const baseSprint = {
	id: SPRINT_ID,
	projectId: PROJECT_ID,
	name: "Sprint 1",
	status: "PLANNING",
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use("/api/sprints", sprintsRouter);
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

const callPut = (
	status: string,
	role: string = "SCRUM_MASTER",
	userId: string = USER_ID,
): Promise<Response> =>
	fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${signToken(role, userId)}`,
		},
		body: JSON.stringify({ status }),
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

const mockSprint = (sprint: unknown) =>
	prisma.sprint.findUnique.mockResolvedValue(sprint);

const mockUpdate = () =>
	prisma.sprint.update.mockImplementation(async ({ data }) => ({
		...baseSprint,
		...(data?.status && { status: data.status }),
	}));

const fullSprint = (status: string) => ({
	...baseSprint,
	status,
	project: { members: MEMBERS },
});

beforeEach(() => {
	__resetPrisma();
	__resetNotify();
	// Estado feliz por defecto: SM actualizando un sprint en planificación.
	mockUser("SCRUM_MASTER");
	mockMembership("SCRUM_MASTER");
	mockSprint(fullSprint("PLANNING"));
	mockUpdate();
});

describe("PUT /api/sprints/:id — autorización", () => {
	it("401 sin token", async () => {
		const res = await fetch(`${baseUrl}/api/sprints/${SPRINT_ID}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "ACTIVE" }),
		});
		expect(res.status).toBe(401);
		expect(prisma.sprint.update).not.toHaveBeenCalled();
	});

	it("403 para TEAM_DEVELOPER", async () => {
		mockUser("USER");
		mockMembership("TEAM_DEVELOPER");
		const res = await callPut("ACTIVE", "USER");
		expect(res.status).toBe(403);
		expect(prisma.sprint.update).not.toHaveBeenCalled();
	});

	it("403 sin membresía en el proyecto", async () => {
		mockUser("USER");
		mockMembership(null);
		const res = await callPut("ACTIVE", "USER");
		expect(res.status).toBe(403);
		expect(prisma.sprint.update).not.toHaveBeenCalled();
	});

	it("200 para SCRUM_MASTER iniciando el sprint", async () => {
		const res = await callPut("ACTIVE", "SCRUM_MASTER");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.status).toBe("ACTIVE");
		expect(prisma.sprint.update).toHaveBeenCalledWith({
			where: { id: SPRINT_ID },
			data: { status: "ACTIVE" },
		});
	});

	it("200 para PRODUCT_OWNER completando el sprint", async () => {
		mockUser("PRODUCT_OWNER");
		mockMembership("PRODUCT_OWNER");
		mockSprint(fullSprint("ACTIVE"));
		const res = await callPut("COMPLETED", "PRODUCT_OWNER");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.status).toBe("COMPLETED");
		expect(prisma.sprint.update).toHaveBeenCalledWith({
			where: { id: SPRINT_ID },
			data: { status: "COMPLETED" },
		});
	});

	it("200 para ADMIN sin ser miembro (bypass)", async () => {
		mockUser("ADMIN");
		mockMembership(null);
		const res = await callPut("ACTIVE", "ADMIN");
		expect(res.status).toBe(200);
		expect(prisma.sprint.update).toHaveBeenCalled();
	});

	it("400 si el sprint no existe (projectId required)", async () => {
		mockSprint(null);
		const res = await callPut("ACTIVE");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("projectId required");
		expect(prisma.sprint.update).not.toHaveBeenCalled();
	});
});

describe("PUT /api/sprints/:id — notificaciones al completar", () => {
	it("al pasar de PLANNING a COMPLETED notifica una vez por miembro", async () => {
		mockSprint(fullSprint("PLANNING"));
		const res = await callPut("COMPLETED");
		expect(res.status).toBe(200);
		expect(notifyMock).toHaveBeenCalledTimes(MEMBERS.length);

		const notifiedUserIds = notifyMock.mock.calls
			.map((call) => (call[0] as { userId: string }).userId)
			.sort();
		expect(notifiedUserIds).toEqual(MEMBERS.map((m) => m.userId).sort());
		for (const call of notifyMock.mock.calls) {
			const payload = call[0] as { type: string; entityId: string };
			expect(payload.type).toBe("SPRINT_COMPLETED");
			expect(payload.entityId).toBe(SPRINT_ID);
		}
	});

	it("al pasar de ACTIVE a COMPLETED notifica igualmente", async () => {
		mockSprint(fullSprint("ACTIVE"));
		const res = await callPut("COMPLETED");
		expect(res.status).toBe(200);
		expect(notifyMock).toHaveBeenCalledTimes(MEMBERS.length);
	});

	it("no re-notifica si el sprint ya estaba COMPLETED", async () => {
		mockSprint(fullSprint("COMPLETED"));
		const res = await callPut("COMPLETED");
		expect(res.status).toBe(200);
		expect(notifyMock).not.toHaveBeenCalled();
	});

	it("no notifica al iniciar el sprint (ACTIVE)", async () => {
		const res = await callPut("ACTIVE");
		expect(res.status).toBe(200);
		expect(notifyMock).not.toHaveBeenCalled();
	});
});
