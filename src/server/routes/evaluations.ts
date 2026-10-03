import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireSystemRole } from "../middleware/system-rbac";

const router = Router();

// GET evaluación por ID - any authenticated
router.get("/:id", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const evaluation = await prisma.evaluation.findUnique({
			where: { id },
			include: {
				criteria: {
					include: { criteria: true },
				},
				evaluator: {
					select: { name: true, id: true },
				},
			},
		});
		if (!evaluation)
			return res.status(404).json({ error: "Evaluación no encontrada" });
		res.json({ data: evaluation });
	} catch (error) {
		console.error("Error getting evaluation:", error);
		res.status(500).json({ error: "Error al obtener evaluación" });
	}
});

// GET evaluaciones de una tarea - ADMIN only
router.get(
	"/task/:taskId",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { taskId } = req.params;
			const evaluations = await prisma.evaluation.findMany({
				where: { taskId },
				include: {
					evaluator: {
						select: { name: true, id: true },
					},
					criteria: true,
				},
				orderBy: { createdAt: "desc" },
			});
			res.json({ data: evaluations });
		} catch (error) {
			console.error("Error getting task evaluations:", error);
			res.status(500).json({ error: "Error al obtener evaluaciones" });
		}
	},
);

// GET evaluaciones de un sprint - ADMIN only
router.get(
	"/sprint/:sprintId",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { sprintId } = req.params;
			const evaluations = await prisma.evaluation.findMany({
				where: { sprintId },
				include: {
					evaluator: {
						select: { name: true, id: true },
					},
					criteria: true,
				},
				orderBy: { createdAt: "desc" },
			});
			res.json({ data: evaluations });
		} catch (error) {
			console.error("Error getting sprint evaluations:", error);
			res.status(500).json({ error: "Error al obtener evaluaciones" });
		}
	},
);

// GET evaluaciones de un proyecto - ADMIN only
router.get(
	"/project/:projectId/general",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { projectId } = req.params;
			const evaluations = await prisma.evaluation.findMany({
				where: {
					projectId,
					taskId: null,
					sprintId: null,
				},
				include: {
					evaluator: {
						select: { name: true, id: true },
					},
					criteria: true,
				},
				orderBy: { createdAt: "desc" },
			});
			res.json({ data: evaluations });
		} catch (error) {
			console.error("Error getting project evaluations:", error);
			res.status(500).json({ error: "Error al obtener evaluaciones" });
		}
	},
);

// GET evaluaciones de un estudiante - any authenticated (own) or ADMIN
router.get("/student/:studentId", authenticateToken, async (req, res) => {
	try {
		const { studentId } = req.params;

		if (req.user!.userId !== studentId && req.user!.role !== "ADMIN") {
			return res.sendStatus(403);
		}

		const taskEvaluations = await prisma.evaluation.findMany({
			where: {
				task: { assigneeId: studentId },
			},
			include: {
				project: { select: { name: true } },
				task: { select: { title: true } },
				sprint: { select: { name: true } },
				evaluator: { select: { name: true } },
			},
		});

		const memberships = await prisma.projectMember.findMany({
			where: { userId: studentId },
			select: { projectId: true },
		});
		const projectIds = memberships.map((m) => m.projectId);

		const teamEvaluations = await prisma.evaluation.findMany({
			where: {
				projectId: { in: projectIds },
				taskId: null,
			},
			include: {
				project: { select: { name: true } },
				sprint: { select: { name: true } },
				evaluator: { select: { name: true } },
			},
		});

		const allEvaluations = [...taskEvaluations, ...teamEvaluations].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		res.json({ data: allEvaluations });
	} catch (error) {
		console.error("Error getting student evaluations:", error);
		res.status(500).json({ error: "Error al obtener mis calificaciones" });
	}
});

// POST crear evaluación - ADMIN only
router.post(
	"/",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const {
				projectId,
				taskId,
				sprintId,
				evaluatorId,
				feedback,
				criteriaScores,
				score,
			} = req.body;

			if (!projectId || !evaluatorId || !Array.isArray(criteriaScores)) {
				return res
					.status(400)
					.json({ error: "Datos inválidos: Faltan campos básicos" });
			}

			const user = await prisma.user.findUnique({ where: { id: evaluatorId } });
			if (!user)
				return res.status(404).json({ error: "Evaluador no encontrado" });

			const evaluation = await prisma.$transaction(async (tx) => {
				const evalRecord = await tx.evaluation.create({
					data: {
						projectId,
						taskId: taskId || null,
						sprintId: sprintId || null,
						evaluatorId,
						feedback,
						status: "COMPLETED",
					},
				});

				for (const cs of criteriaScores) {
					await tx.evaluationCriteria.create({
						data: {
							evaluationId: evalRecord.id,
							criteriaId: cs.criteriaId,
							score: cs.score,
							comment: cs.comment,
						},
					});
				}

				return tx.evaluation.update({
					where: { id: evalRecord.id },
					data: { score: score || 0 },
					include: { criteria: true },
				});
			});

			res.status(201).json({ data: evaluation });
		} catch (error) {
			console.error("Error creating evaluation:", error);
			res.status(500).json({ error: "Error al guardar evaluación" });
		}
	},
);

// PUT actualizar evaluación - ADMIN only
router.put(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { feedback, criteriaScores, score } = req.body;

			if (!Array.isArray(criteriaScores)) {
				return res.status(400).json({ error: "Datos de criterios inválidos" });
			}

			const updatedEvaluation = await prisma.$transaction(async (tx) => {
				await tx.evaluation.update({
					where: { id },
					data: {
						feedback,
						score,
					},
				});

				await tx.evaluationCriteria.deleteMany({
					where: { evaluationId: id },
				});

				for (const cs of criteriaScores) {
					await tx.evaluationCriteria.create({
						data: {
							evaluationId: id,
							criteriaId: cs.criteriaId,
							score: cs.score,
							comment: cs.comment,
						},
					});
				}

				return tx.evaluation.findUnique({
					where: { id },
					include: { criteria: true },
				});
			});

			res.json({ data: updatedEvaluation });
		} catch (error) {
			console.error("Error updating evaluation:", error);
			res.status(500).json({ error: "Error al actualizar evaluación" });
		}
	},
);

export default router;
