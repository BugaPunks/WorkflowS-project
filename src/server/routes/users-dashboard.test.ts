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
		user: { findUnique: vi.fn(), update: vi.fn() },
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

vi.mock("../db", () => ({ prisma, default: prisma }));

import { JWT_AUDIENCE, JWT_ISSUER } from "../middleware/auth";
import usersRouter from "./users";

const TEST_JWT_SECRET =
	process.env.JWT_SECRET ?? "test-secret-key-0123456789abcdef-0123456789";

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use("/api/users", usersRouter);
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

const mockUser = (role: string, userId: string = USER_ID) =>
	prisma.user.findUnique.mockResolvedValue({
		id: userId,
		email: "test@example.com",
		role,
		active: true,
		tokenVersion: 0,
	});

const mockSummaryUser = (role: string, userId: string = USER_ID) => ({
	id: userId,
	email: "test@example.com",
	role,
	active: true,
	tokenVersion: 0,
	createdAt: new Date(),
	updatedAt: new Date(),
	dashboardModules: null,
	tasks: [],
	projects: [],
	projectMemberships: [],
});

beforeEach(() => {
	__resetPrisma();
	mockUser("TEAM_DEVELOPER");
});

describe("GET /api/users/:id/dashboard-summary — identidad del JWT", () => {
	it("200 para no-admin con su propio id", async () => {
		prisma.user.findUnique.mockResolvedValue(mockSummaryUser("TEAM_DEVELOPER"));
		const res = await fetch(`${baseUrl}/api/users/${USER_ID}/dashboard-summary`, {
			headers: { Authorization: `Bearer ${signToken("TEAM_DEVELOPER")}` },
		});
		expect(res.status).toBe(200);
	});

	it("200 para no-admin con id de otro usuario (consulta sus propios datos)", async () => {
		prisma.user.findUnique.mockResolvedValue(mockSummaryUser("TEAM_DEVELOPER"));
		const res = await fetch(
			`${baseUrl}/api/users/${OTHER_USER_ID}/dashboard-summary`,
			{
				headers: { Authorization: `Bearer ${signToken("TEAM_DEVELOPER")}` },
			},
		);
		expect(res.status).toBe(200);
		expect(prisma.user.findUnique).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: USER_ID } }),
		);
	});

	it("200 para ADMIN con id de otro usuario (consulta los datos del otro)", async () => {
		mockUser("ADMIN");
		prisma.user.findUnique.mockResolvedValue(mockSummaryUser("TEAM_DEVELOPER", OTHER_USER_ID));
		const res = await fetch(
			`${baseUrl}/api/users/${OTHER_USER_ID}/dashboard-summary`,
			{
				headers: { Authorization: `Bearer ${signToken("ADMIN")}` },
			},
		);
		expect(res.status).toBe(200);
	});

	it("401 sin token", async () => {
		const res = await fetch(
			`${baseUrl}/api/users/${USER_ID}/dashboard-summary`,
		);
		expect(res.status).toBe(401);
	});
});

describe("PUT /api/users/:id/dashboard — identidad del JWT", () => {
	const modules = ["chart", "calendar"];

	beforeEach(() => {
		prisma.user.update.mockResolvedValue({ id: USER_ID });
	});

	it("200 para no-admin con su propio id", async () => {
		const res = await fetch(`${baseUrl}/api/users/${USER_ID}/dashboard`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${signToken("TEAM_DEVELOPER")}`,
			},
			body: JSON.stringify({ modules }),
		});
		expect(res.status).toBe(200);
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: USER_ID } }),
		);
	});

	it("200 para no-admin con id de otro usuario (guarda su propia configuración)", async () => {
		const res = await fetch(`${baseUrl}/api/users/${OTHER_USER_ID}/dashboard`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${signToken("TEAM_DEVELOPER")}`,
			},
			body: JSON.stringify({ modules }),
		});
		expect(res.status).toBe(200);
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: USER_ID } }),
		);
	});

	it("200 para ADMIN con id de otro usuario (actualiza la configuración del otro)", async () => {
		mockUser("ADMIN");
		const res = await fetch(`${baseUrl}/api/users/${OTHER_USER_ID}/dashboard`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${signToken("ADMIN")}`,
			},
			body: JSON.stringify({ modules }),
		});
		expect(res.status).toBe(200);
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: OTHER_USER_ID } }),
		);
	});
});