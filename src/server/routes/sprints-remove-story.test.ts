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
		sprint: { findUnique: vi.fn() },
		projectMember: { findUnique: vi.fn() },
		userStory: { findUnique: vi.fn(), update: vi.fn() },
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
import sprintsRouter from "./sprints";

const TEST_JWT_SECRET =
	process.env.JWT_SECRET ?? "test-secret-key-0123456789abcdef-0123456789";

const PROJECT_ID = "proj-1";
const SPRINT_ID = "sprint-1";
const OTHER_SPRINT_ID = "sprint-2";
const STORY_ID = "story-1";
const USER_ID = "user-1";

const baseStory = {
	id: STORY_ID,
	projectId: PROJECT_ID,
	title: "Historia de prueba",
	description: "desc",
	priority: "MEDIUM",
	status: "BACKLOG",
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

const callDelete = (
	storyId: string = STORY_ID,
	sprintId: string = SPRINT_ID,
	role: string = "PRODUCT_OWNER",
	userId: string = USER_ID,
): Promise<Response> =>
	fetch(`${baseUrl}/api/sprints/${sprintId}/stories/${storyId}`, {
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

const mockStory = (story: unknown) =>
	prisma.userStory.findUnique.mockResolvedValue(story);

const mockUpdate = () =>
	prisma.userStory.update.mockImplementation(async ({ data }) => ({
		...baseStory,
		...(data && { sprintId: (data as { sprintId: string | null }).sprintId }),
	}));

beforeEach(() => {
	__resetPrisma();
	// Estado feliz por defecto
	mockUser("PRODUCT_OWNER");
	mockMembership("PRODUCT_OWNER");
	prisma.sprint.findUnique.mockResolvedValue({
		id: SPRINT_ID,
		projectId: PROJECT_ID,
	});
	mockStory({ ...baseStory, sprintId: SPRINT_ID });
	mockUpdate();
});

describe("DELETE /api/sprints/:id/stories/:storyId — autorización", () => {
	it("401 sin token", async () => {
		const res = await fetch(
			`${baseUrl}/api/sprints/${SPRINT_ID}/stories/${STORY_ID}`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(401);
		expect(prisma.userStory.update).not.toHaveBeenCalled();
	});

	it("403 para TEAM_DEVELOPER", async () => {
		mockUser("USER");
		mockMembership("TEAM_DEVELOPER");
		const res = await callDelete();
		expect(res.status).toBe(403);
		expect(prisma.userStory.update).not.toHaveBeenCalled();
	});

	it("403 sin membresía en el proyecto", async () => {
		mockUser("USER");
		mockMembership(null);
		const res = await callDelete();
		expect(res.status).toBe(403);
		expect(prisma.userStory.update).not.toHaveBeenCalled();
	});

	it("200 para PRODUCT_OWNER", async () => {
		mockUser("PRODUCT_OWNER");
		mockMembership("PRODUCT_OWNER");
		const res = await callDelete();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.sprintId).toBeNull();
	});

	it("200 para SCRUM_MASTER", async () => {
		mockUser("SCRUM_MASTER");
		mockMembership("SCRUM_MASTER");
		const res = await callDelete();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.sprintId).toBeNull();
	});

	it("200 para ADMIN sin ser miembro (bypass)", async () => {
		mockUser("ADMIN");
		mockMembership(null);
		const res = await callDelete();
		expect(res.status).toBe(200);
		expect(prisma.userStory.update).toHaveBeenCalled();
	});

	it("400 si el sprint no existe (projectId required)", async () => {
		prisma.sprint.findUnique.mockResolvedValue(null);
		const res = await callDelete();
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("projectId required");
		expect(prisma.userStory.update).not.toHaveBeenCalled();
	});
});

describe("DELETE /api/sprints/:id/stories/:storyId — handler", () => {
	it("404 si la historia no existe (sin tocar update)", async () => {
		mockStory(null);
		const res = await callDelete();
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("Historia no encontrada");
		expect(prisma.userStory.update).not.toHaveBeenCalled();
	});

	it("404 si la historia pertenece a otro sprint (sin tocar update)", async () => {
		mockStory({ ...baseStory, sprintId: OTHER_SPRINT_ID });
		const res = await callDelete();
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("La historia no pertenece a este sprint");
		expect(prisma.userStory.update).not.toHaveBeenCalled();
	});

	it("200 y update llamado con data.sprintId = null", async () => {
		const res = await callDelete();
		expect(res.status).toBe(200);
		expect(prisma.userStory.update).toHaveBeenCalledWith({
			where: { id: STORY_ID },
			data: { sprintId: null },
		});
	});
});
