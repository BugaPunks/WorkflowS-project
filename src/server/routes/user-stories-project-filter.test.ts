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
		userStory: { findMany: vi.fn() },
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

// Aislar la capa de datos: solo se mockea prisma; el middleware auth se ejecuta
// REAL contra estos mocks. El filtrado por proyecto lo aplica el propio handler.
vi.mock("../db", () => ({ prisma, default: prisma }));

import { JWT_AUDIENCE, JWT_ISSUER } from "../middleware/auth";
import userStoriesRouter from "./user-stories";

const TEST_JWT_SECRET =
	process.env.JWT_SECRET ?? "test-secret-key-0123456789abcdef-0123456789";

const PROJECT_A = "proj-a";
const PROJECT_B = "proj-b";
const USER_ID = "user-1";

const STORIES = [
	{ id: "story-a1", projectId: PROJECT_A, title: "Historia A1" },
	{ id: "story-a2", projectId: PROJECT_A, title: "Historia A2" },
	{ id: "story-b1", projectId: PROJECT_B, title: "Historia B1" },
];

let server: Server;
let baseUrl: string;

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use("/api/user-stories", userStoriesRouter);
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

const callGet = (
	query: string = "",
	role: string = "TEAM_DEVELOPER",
	userId: string = USER_ID,
): Promise<Response> =>
	fetch(`${baseUrl}/api/user-stories${query}`, {
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

beforeEach(() => {
	__resetPrisma();
	mockUser("TEAM_DEVELOPER");
	// Reproduce el filtrado que Prisma haría con `where: { projectId }`.
	prisma.userStory.findMany.mockImplementation(
		async (args?: { where?: { projectId?: string } }) => {
			const projectId = args?.where?.projectId;
			return projectId
				? STORIES.filter((story) => story.projectId === projectId)
				: STORIES;
		},
	);
});

describe("GET /api/user-stories — filtrado por proyecto", () => {
	it("401 sin token", async () => {
		const res = await fetch(`${baseUrl}/api/user-stories`);
		expect(res.status).toBe(401);
		expect(prisma.userStory.findMany).not.toHaveBeenCalled();
	});

	it("sin projectId devuelve todas las historias", async () => {
		const res = await callGet();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(STORIES.length);
		expect(prisma.userStory.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: {} }),
		);
	});

	it("con projectId=A devuelve solo las historias de A", async () => {
		const res = await callGet(`?projectId=${PROJECT_A}`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.map((s: { id: string }) => s.id)).toEqual([
			"story-a1",
			"story-a2",
		]);
		expect(prisma.userStory.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { projectId: PROJECT_A } }),
		);
	});

	it("con proyecto inexistente devuelve lista vacía (sin error)", async () => {
		const res = await callGet("?projectId=no-existe");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toEqual([]);
	});

	it("un no-miembro autenticado recibe las historias del proyecto (no depende de membresía)", async () => {
		// El handler GET no consulta projectMember: solo autentica. Que el mock
		// carezca de projectMember demuestra que la membresía no influye.
		mockUser("USER");
		const res = await callGet(`?projectId=${PROJECT_A}`, "USER");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(2);
		expect(
			body.data.every((s: { projectId: string }) => s.projectId === PROJECT_A),
		).toBe(true);
	});
});
