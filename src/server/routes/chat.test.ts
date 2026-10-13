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
		chat: { findUnique: vi.fn(), findMany: vi.fn() },
		projectMember: { findUnique: vi.fn() },
		message: { findMany: vi.fn(), create: vi.fn() },
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
// chat-rbac se ejecutan REALES contra estos mocks.
vi.mock("../db", () => ({ prisma, default: prisma }));
vi.mock("../lib/notify", () => ({ notify: notifyMock }));

import { JWT_AUDIENCE, JWT_ISSUER } from "../middleware/auth";
import chatRouter from "./chat";

const TEST_JWT_SECRET =
	process.env.JWT_SECRET ?? "test-secret-key-0123456789abcdef-0123456789";

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const CHAT_ID = "chat-1";
const PROJECT_ID = "proj-1";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use("/api/chat", chatRouter);
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

const directChat = (participantIds: string[]) => ({
	id: CHAT_ID,
	type: "DIRECT",
	projectId: null,
	participants: participantIds.map((userId) => ({ chatId: CHAT_ID, userId })),
});

const projectChat = () => ({
	id: CHAT_ID,
	type: "PROJECT",
	projectId: PROJECT_ID,
	participants: [],
});

const mockMessage = { id: "msg-1", chatId: CHAT_ID, userId: USER_ID, content: "hola", user: { name: "Ana" } };

beforeEach(() => {
	__resetPrisma();
	__resetNotify();
	// Estado feliz por defecto: usuario participante en un DM directo.
	mockUser("TEAM_DEVELOPER");
	prisma.chat.findUnique.mockResolvedValue(directChat([USER_ID, OTHER_USER_ID]));
	prisma.message.findMany.mockResolvedValue([]);
	prisma.message.create.mockResolvedValue(mockMessage);
});

const getMessages = (role = "TEAM_DEVELOPER", userId = USER_ID): Promise<Response> =>
	fetch(`${baseUrl}/api/chat/conversation/${CHAT_ID}/messages`, {
		headers: { Authorization: `Bearer ${signToken(role, userId)}` },
	});

const postMessage = (role = "TEAM_DEVELOPER", userId = USER_ID): Promise<Response> =>
	fetch(`${baseUrl}/api/chat/conversation/${CHAT_ID}/messages`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${signToken(role, userId)}`,
		},
		body: JSON.stringify({ content: "hola" }),
	});

describe("GET /api/chat/conversation/:chatId/messages — autorización", () => {
	it("401 sin token", async () => {
		const res = await fetch(
			`${baseUrl}/api/chat/conversation/${CHAT_ID}/messages`,
		);
		expect(res.status).toBe(401);
		expect(prisma.message.findMany).not.toHaveBeenCalled();
	});

	it("404 si el chat no existe", async () => {
		prisma.chat.findUnique.mockResolvedValue(null);
		const res = await getMessages();
		expect(res.status).toBe(404);
		expect(prisma.message.findMany).not.toHaveBeenCalled();
	});

	it("403 para no-participante de un DM", async () => {
		prisma.chat.findUnique.mockResolvedValue(directChat([OTHER_USER_ID]));
		const res = await getMessages();
		expect(res.status).toBe(403);
		expect(prisma.message.findMany).not.toHaveBeenCalled();
	});

	it("200 para participante", async () => {
		prisma.message.findMany.mockResolvedValue([mockMessage]);
		const res = await getMessages();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(1);
	});

	it("403 para miembro de otro proyecto en un chat PROJECT", async () => {
		prisma.chat.findUnique.mockResolvedValue(projectChat());
		prisma.projectMember.findUnique.mockResolvedValue(null);
		const res = await getMessages();
		expect(res.status).toBe(403);
		expect(prisma.message.findMany).not.toHaveBeenCalled();
	});

	it("200 para miembro del proyecto en un chat PROJECT", async () => {
		prisma.chat.findUnique.mockResolvedValue(projectChat());
		prisma.projectMember.findUnique.mockResolvedValue({
			id: "m-1",
			projectId: PROJECT_ID,
			userId: USER_ID,
			role: "TEAM_DEVELOPER",
		});
		prisma.message.findMany.mockResolvedValue([]);
		const res = await getMessages();
		expect(res.status).toBe(200);
	});

	it("200 para ADMIN (bypass) aunque no sea participante", async () => {
		mockUser("ADMIN");
		prisma.chat.findUnique.mockResolvedValue(directChat([OTHER_USER_ID]));
		prisma.message.findMany.mockResolvedValue([]);
		const res = await getMessages("ADMIN");
		expect(res.status).toBe(200);
	});
});

describe("POST /api/chat/conversation/:chatId/messages — autorización", () => {
	it("403 para no-participante: no crea mensaje ni notifica", async () => {
		prisma.chat.findUnique.mockResolvedValue(directChat([OTHER_USER_ID]));
		const res = await postMessage();
		expect(res.status).toBe(403);
		expect(prisma.message.create).not.toHaveBeenCalled();
		expect(notifyMock).not.toHaveBeenCalled();
	});

	it("201 para participante y notifica a los demás", async () => {
		const res = await postMessage();
		expect(res.status).toBe(201);
		expect(prisma.message.create).toHaveBeenCalled();
		expect(notifyMock).toHaveBeenCalledTimes(1);
		const payload = notifyMock.mock.calls[0][0] as { userId: string };
		expect(payload.userId).toBe(OTHER_USER_ID);
	});

	it("201 para ADMIN (bypass) aunque no sea participante", async () => {
		mockUser("ADMIN");
		prisma.chat.findUnique.mockResolvedValue(directChat([OTHER_USER_ID]));
		const res = await postMessage("ADMIN");
		expect(res.status).toBe(201);
		expect(prisma.message.create).toHaveBeenCalled();
	});
});

describe("GET /api/chat/user/:userId/all — identidad del JWT", () => {
	const myChats = [
		{
			id: "chat-mio",
			type: "DIRECT",
			participants: [{ userId: USER_ID }],
			messages: [],
		},
	];

	beforeEach(() => {
		prisma.chat.findMany.mockResolvedValue(myChats);
	});

	it("200 para no-admin con su propio id", async () => {
		const res = await fetch(`${baseUrl}/api/chat/user/${USER_ID}/all`, {
			headers: { Authorization: `Bearer ${signToken("TEAM_DEVELOPER")}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(1);
	});

	it("200 para no-admin con id de otro usuario (el parámetro se ignora)", async () => {
		const res = await fetch(`${baseUrl}/api/chat/user/${OTHER_USER_ID}/all`, {
			headers: { Authorization: `Bearer ${signToken("TEAM_DEVELOPER")}` },
		});
		expect(res.status).toBe(200);
		// Consulta sus propios chats (USER_ID), no los del parámetro.
		expect(prisma.chat.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					type: "DIRECT",
					participants: { some: { userId: USER_ID } },
				},
			}),
		);
	});

	it("200 para ADMIN con id de otro usuario (el parámetro es efectivo)", async () => {
		mockUser("ADMIN");
		const res = await fetch(`${baseUrl}/api/chat/user/${OTHER_USER_ID}/all`, {
			headers: { Authorization: `Bearer ${signToken("ADMIN")}` },
		});
		expect(res.status).toBe(200);
		expect(prisma.chat.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					type: "DIRECT",
					participants: { some: { userId: OTHER_USER_ID } },
				},
			}),
		);
	});
});