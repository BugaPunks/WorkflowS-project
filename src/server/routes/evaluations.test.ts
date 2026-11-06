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
	process.env.JWT_SECRET = "test-secret-key-0123456789abcdef-0123456789";
	const prisma = {
		user: { findUnique: vi.fn() },
		task: { findUnique: vi.fn() },
		criteria: { findMany: vi.fn(), findUnique: vi.fn() },
		evaluation: {
			create: vi.fn(),
			update: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
		},
		evaluationCriteria: {
			create: vi.fn(),
			createMany: vi.fn(),
			deleteMany: vi.fn(),
		},
		$transaction: vi.fn(),
	};
	const notifyMock = vi.fn();
	return {
		prisma,
		notifyMock,
		__resetPrisma: () => {
			for (const delegate of Object.values(prisma)) {
				if (typeof delegate === "object" && delegate !== null) {
					for (const fn of Object.values(delegate)) {
						if (typeof fn === "function" && "mockReset" in fn) {
							(fn as any).mockReset();
						}
					}
				} else if (typeof delegate === "function" && "mockReset" in delegate) {
					(delegate as any).mockReset();
				}
			}
		},
		__resetNotify: () => notifyMock.mockReset(),
	};
});

vi.mock("../db", () => ({ prisma, default: prisma }));
vi.mock("../lib/notify", () => ({ notify: notifyMock }));

import { JWT_AUDIENCE, JWT_ISSUER } from "../middleware/auth";
import evaluationsRouter from "./evaluations";
import tasksRouter from "./tasks";

const TEST_JWT_SECRET =
	process.env.JWT_SECRET ?? "test-secret-key-0123456789abcdef-0123456789";

const ADMIN_ID = "admin-1";
const STUDENT_ID = "student-1";
const PROJECT_ID = "project-1";
const SPRINT_ID = "sprint-1";
const EVAL_ID = "eval-1";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use("/api/evaluations", evaluationsRouter);
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

const signToken = (role: string, userId: string = ADMIN_ID): string =>
	jwt.sign({ userId, email: "test@example.com", role, v: 0 }, TEST_JWT_SECRET, {
		algorithm: "HS256",
		issuer: JWT_ISSUER,
		audience: JWT_AUDIENCE,
	});

describe("Evaluations Route - Criteria Score Validations", () => {
	beforeEach(() => {
		__resetPrisma();
		__resetNotify();

		// Default: evaluator exists
		prisma.user.findUnique.mockImplementation(async (args: any) => {
			const id = args?.where?.id;
			if (id === ADMIN_ID) {
				return {
					id: ADMIN_ID,
					name: "Admin Evaluator",
					email: "admin@example.com",
					role: "ADMIN",
					active: true,
					tokenVersion: 0,
				};
			}
			if (id === STUDENT_ID) {
				return {
					id: STUDENT_ID,
					name: "Student",
					email: "student@example.com",
					role: "TEAM_DEVELOPER",
					active: true,
					tokenVersion: 0,
				};
			}
			return null;
		});

		// Default transaction implementation
		prisma.$transaction.mockImplementation(async (cb: any) => {
			const tx = {
				evaluation: {
					create: vi.fn().mockResolvedValue({
						id: EVAL_ID,
						projectId: PROJECT_ID,
						sprintId: SPRINT_ID,
						evaluatorId: ADMIN_ID,
						feedback: "Good",
						status: "COMPLETED",
					}),
					update: vi.fn().mockResolvedValue({
						id: EVAL_ID,
						score: 85,
						criteria: [],
					}),
					findUnique: vi.fn().mockResolvedValue({
						id: EVAL_ID,
						score: 85,
						criteria: [],
					}),
				},
				evaluationCriteria: {
					create: vi.fn().mockResolvedValue({ id: "ec-1" }),
					createMany: vi.fn().mockResolvedValue({ count: 1 }),
					deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
			};
			return cb(tx);
		});
	});

	describe("POST /api/evaluations - Score Upper & Lower Boundary Enforcement", () => {
		it("rechaza la evaluación si un criterio excede su maxScore (ej. 40/30)", async () => {
			prisma.criteria.findMany.mockResolvedValue([
				{ id: "crit-1", name: "Arquitectura", maxScore: 30, weight: 1 },
			]);

			const res = await fetch(`${baseUrl}/api/evaluations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					projectId: PROJECT_ID,
					sprintId: SPRINT_ID,
					evaluatorId: ADMIN_ID,
					feedback: "Excelente",
					score: 90,
					criteriaScores: [
						{ criteriaId: "crit-1", score: 40, comment: "Superó el máximo" },
					],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("Arquitectura");
			expect(data.error).toContain("40");
			expect(data.error).toContain("30");
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it("rechaza la evaluación si un criterio tiene puntaje negativo (ej. -5)", async () => {
			const res = await fetch(`${baseUrl}/api/evaluations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					projectId: PROJECT_ID,
					sprintId: SPRINT_ID,
					evaluatorId: ADMIN_ID,
					feedback: "Insuficiente",
					score: 50,
					criteriaScores: [
						{ criteriaId: "crit-1", score: -5, comment: "Negativo" },
					],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("no puede ser negativo");
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it("rechaza la evaluación si el puntaje del criterio no es un número", async () => {
			const res = await fetch(`${baseUrl}/api/evaluations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					projectId: PROJECT_ID,
					sprintId: SPRINT_ID,
					evaluatorId: ADMIN_ID,
					feedback: "Inválido",
					score: 50,
					criteriaScores: [
						{ criteriaId: "crit-1", score: "not-a-number", comment: "" },
					],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("debe ser un número válido");
		});

		it("rechaza la evaluación si la calificación total es mayor a 100", async () => {
			const res = await fetch(`${baseUrl}/api/evaluations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					projectId: PROJECT_ID,
					sprintId: SPRINT_ID,
					evaluatorId: ADMIN_ID,
					feedback: "Fuera de rango",
					score: 110,
					criteriaScores: [],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("La calificación final debe estar entre 0 y 100");
		});

		it("rechaza la evaluación si la calificación total es menor a 0", async () => {
			const res = await fetch(`${baseUrl}/api/evaluations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					projectId: PROJECT_ID,
					sprintId: SPRINT_ID,
					evaluatorId: ADMIN_ID,
					feedback: "Fuera de rango",
					score: -10,
					criteriaScores: [],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("La calificación final debe estar entre 0 y 100");
		});

		it("rechaza la evaluación si un criteriaId no existe en la base de datos", async () => {
			prisma.criteria.findMany.mockResolvedValue([]);

			const res = await fetch(`${baseUrl}/api/evaluations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					projectId: PROJECT_ID,
					sprintId: SPRINT_ID,
					evaluatorId: ADMIN_ID,
					feedback: "Test",
					score: 80,
					criteriaScores: [{ criteriaId: "crit-inexistente", score: 20 }],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("Criterio no encontrado");
		});

		it("permite la evaluación con puntajes exactos en los límites (0 y maxScore exacto: 30/30)", async () => {
			prisma.criteria.findMany.mockResolvedValue([
				{ id: "crit-1", name: "Arquitectura", maxScore: 30, weight: 1 },
				{ id: "crit-2", name: "Testing", maxScore: 20, weight: 1 },
			]);

			const res = await fetch(`${baseUrl}/api/evaluations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					projectId: PROJECT_ID,
					sprintId: SPRINT_ID,
					evaluatorId: ADMIN_ID,
					feedback: "Límites válidos",
					score: 60,
					criteriaScores: [
						{ criteriaId: "crit-1", score: 30, comment: "Puntaje máximo exacto" },
						{ criteriaId: "crit-2", score: 0, comment: "Puntaje mínimo exacto" },
					],
				}),
			});

			expect(res.status).toBe(201);
			expect(prisma.$transaction).toHaveBeenCalled();
		});

		it("rechaza usuarios no ADMIN con 403 Forbidden", async () => {
			const res = await fetch(`${baseUrl}/api/evaluations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("TEAM_DEVELOPER", STUDENT_ID)}`,
				},
				body: JSON.stringify({
					projectId: PROJECT_ID,
					sprintId: SPRINT_ID,
					evaluatorId: STUDENT_ID,
					feedback: "Intento no autorizado",
					score: 100,
					criteriaScores: [],
				}),
			});

			expect(res.status).toBe(403);
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});
	});

	describe("PUT /api/evaluations/:id - Score Upper & Lower Boundary Enforcement", () => {
		it("rechaza la actualización si un criterio excede su maxScore (ej. 45/30)", async () => {
			prisma.criteria.findMany.mockResolvedValue([
				{ id: "crit-1", name: "Arquitectura", maxScore: 30, weight: 1 },
			]);

			const res = await fetch(`${baseUrl}/api/evaluations/${EVAL_ID}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					feedback: "Modificado",
					score: 95,
					criteriaScores: [
						{ criteriaId: "crit-1", score: 45, comment: "Excedido" },
					],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("Arquitectura");
			expect(data.error).toContain("45");
			expect(data.error).toContain("30");
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it("rechaza la actualización si la calificación total es mayor a 100", async () => {
			const res = await fetch(`${baseUrl}/api/evaluations/${EVAL_ID}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					feedback: "Modificado",
					score: 105,
					criteriaScores: [],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("La calificación final debe estar entre 0 y 100");
		});

		it("permite actualizar la evaluación con puntajes válidos dentro de límites", async () => {
			prisma.criteria.findMany.mockResolvedValue([
				{ id: "crit-1", name: "Arquitectura", maxScore: 30, weight: 1 },
			]);

			const res = await fetch(`${baseUrl}/api/evaluations/${EVAL_ID}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					feedback: "Actualizado correctamente",
					score: 80,
					criteriaScores: [
						{ criteriaId: "crit-1", score: 25, comment: "Puntaje válido" },
					],
				}),
			});

			expect(res.status).toBe(200);
			expect(prisma.$transaction).toHaveBeenCalled();
		});
	});

	describe("POST /api/tasks/:id/evaluate - Task Evaluation Boundary Enforcement", () => {
		const TASK_ID = "task-100";

		beforeEach(() => {
			prisma.task.findUnique.mockResolvedValue({
				id: TASK_ID,
				projectId: PROJECT_ID,
				title: "Implementar Autenticación",
				assigneeId: STUDENT_ID,
			});
		});

		it("rechaza la evaluación de la tarea si un criterio excede maxScore (ej. 35/25)", async () => {
			prisma.criteria.findMany.mockResolvedValue([
				{ id: "crit-task", name: "Seguridad", maxScore: 25, weight: 1 },
			]);

			const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/evaluate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					evaluatorId: ADMIN_ID,
					feedback: "Excede límites",
					score: 90,
					criteriaScores: [
						{ criteriaId: "crit-task", score: 35 },
					],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("Seguridad");
			expect(data.error).toContain("35");
			expect(data.error).toContain("25");
		});

		it("rechaza la evaluación de la tarea si la calificación total es mayor a 100", async () => {
			const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/evaluate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					evaluatorId: ADMIN_ID,
					feedback: "Mayor a 100",
					score: 120,
					criteriaScores: [],
				}),
			});

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("La calificación final debe estar entre 0 y 100");
		});

		it("permite evaluar la tarea cuando los puntajes están dentro de límites", async () => {
			prisma.criteria.findMany.mockResolvedValue([
				{ id: "crit-task", name: "Seguridad", maxScore: 25, weight: 1 },
			]);

			const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/evaluate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${signToken("ADMIN")}`,
				},
				body: JSON.stringify({
					evaluatorId: ADMIN_ID,
					feedback: "Excelente tarea",
					score: 85,
					criteriaScores: [
						{ criteriaId: "crit-task", score: 25 },
					],
				}),
			});

			expect(res.status).toBe(201);
			expect(prisma.$transaction).toHaveBeenCalled();
		});
	});
});
