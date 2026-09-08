import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireProjectRole } from "../middleware/project-rbac";
import { requireSystemRole } from "../middleware/system-rbac";

const router = Router();

const taskCreateSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	projectId: z.string(),
	assigneeId: z.string().optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
	deadline: z.string().optional(),
	status: z.string().optional(),
	sprintId: z.string().optional(),
	userStoryId: z.string().optional(),
});

// GET todas las tareas - any authenticated
router.get("/", authenticateToken, async (req, res) => {
	try {
		const { assigneeId, projectId } = req.query;
		const where: Record<string, string> = {};

		if (assigneeId) where.assigneeId = String(assigneeId);
		if (projectId) where.projectId = String(projectId);

		const tasks = await prisma.task.findMany({
			where,
			include: {
				assignee: {
					select: { id: true, name: true, email: true },
				},
				project: {
					select: { id: true, name: true },
				},
				evaluations: true,
			},
		});
		res.json({ data: tasks });
	} catch {
		res.status(500).json({ error: "Error al obtener tareas" });
	}
});

// GET tarea por ID - any authenticated
router.get("/:id", authenticateToken, async (req, res) => {
	try {
		const task = await prisma.task.findUnique({
			where: { id: req.params.id },
			include: {
				assignee: {
					select: { id: true, name: true, email: true },
				},
				project: {
					select: { id: true, name: true },
				},
				evaluations: true,
			},
		});
		if (!task) return res.status(404).json({ error: "Tarea no encontrada" });
		res.json({ data: task });
	} catch {
		res.status(500).json({ error: "Error al obtener tarea" });
	}
});

// POST crear tarea - any project member
router.post(
	"/",
	authenticateToken,
	requireProjectRole(["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"]),
	async (req, res) => {
		try {
			const parsed = taskCreateSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos inválidos" });
			}

			const {
				title,
				description,
				projectId,
				assigneeId,
				priority,
				deadline,
				status,
				sprintId,
				userStoryId,
			} = parsed.data;

			const task = await prisma.task.create({
				data: {
					title,
					description,
					projectId,
					assigneeId,
					priority: priority || "MEDIUM",
					deadline: deadline ? new Date(deadline) : null,
					status: status || "TODO",
					sprintId: sprintId || null,
					userStoryId: userStoryId || null,
				},
			});

			if (assigneeId) {
				await prisma.notification.create({
					data: {
						userId: assigneeId,
						title: "Nueva Tarea Asignada",
						message: `Se te ha asignado la tarea: ${title}`,
						type: "TASK_ASSIGNED",
					},
				});
			}

			res.status(201).json({ data: task });
		} catch {
			res.status(500).json({ error: "Error al crear tarea" });
		}
	},
);

// PUT actualizar tarea - any project member
router.put(
	"/:id",
	authenticateToken,
	requireProjectRole(
		["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"],
		async (req) => {
			const task = await prisma.task.findUnique({
				where: { id: req.params.id },
			});
			return task?.projectId ?? null;
		},
	),
	async (req, res) => {
		try {
			const { deadline, status, ...updateData } = req.body;

			const dataToUpdate: Record<string, unknown> = { ...updateData };

			if (deadline) dataToUpdate.deadline = new Date(deadline);
			if (status) {
				dataToUpdate.status = status;
				if (status === "COMPLETED" || status === "DONE") {
					dataToUpdate.completedAt = new Date();
				} else if (
					status === "TODO" ||
					status === "IN_PROGRESS" ||
					status === "PENDING"
				) {
					dataToUpdate.completedAt = null;
				}
			}

			const task = await prisma.task.update({
				where: { id: req.params.id },
				data: dataToUpdate,
			});
			res.json({ data: task });
		} catch {
			res.status(500).json({ error: "Error al actualizar tarea" });
		}
	},
);

// DELETE tarea - ADMIN only
router.delete(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			await prisma.task.delete({
				where: { id: req.params.id },
			});
			res.json({ data: { message: "Tarea eliminada" } });
		} catch {
			res.status(500).json({ error: "Error al eliminar tarea" });
		}
	},
);

// POST evaluar tarea - ADMIN only
router.post(
	"/:id/evaluate",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { score, feedback, evaluatorId, criteriaScores } = req.body;
			const taskId = req.params.id;

			if (score === undefined || !evaluatorId) {
				return res.status(400).json({ error: "Faltan campos requeridos" });
			}

			const task = await prisma.task.findUnique({ where: { id: taskId } });
			if (!task) return res.status(404).json({ error: "Tarea no encontrada" });

			const evaluation = await prisma.$transaction(async (tx) => {
				const newEvaluation = await tx.evaluation.create({
					data: {
						taskId,
						projectId: task.projectId,
						evaluatorId,
						score,
						feedback,
						status: "COMPLETED",
					},
				});

				if (criteriaScores && Array.isArray(criteriaScores)) {
					await tx.evaluationCriteria.createMany({
						data: criteriaScores.map(
							(cs: { criteriaId: string; score: number }) => ({
								evaluationId: newEvaluation.id,
								criteriaId: cs.criteriaId,
								score: cs.score,
							}),
						),
					});
				}

				return newEvaluation;
			});

			if (task.assigneeId) {
				await prisma.notification.create({
					data: {
						userId: task.assigneeId,
						title: "Tarea Evaluada",
						message: `Tu tarea "${task.title}" ha sido evaluada con ${score}/100`,
						type: "EVALUATION_COMPLETED",
					},
				});
			}

			res.status(201).json({ data: evaluation });
		} catch (error) {
			console.error("Error al evaluar tarea:", error);
			res.status(500).json({ error: "Error al guardar la evaluación" });
		}
	},
);

export default router;
