import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { requireSystemRole } from "../middleware/system-rbac";

const router = Router();

const rubricCreateSchema = z.object({
	projectId: z.string().nullable().optional(),
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	criteria: z.array(
		z.object({
			name: z.string().min(1),
			maxScore: z.number().min(1),
			weight: z.number().min(0),
		}),
	),
});

// GET Rúbricas - any authenticated
router.get("/", authenticateToken, async (req, res) => {
	try {
		const projectId = req.query.projectId as string | undefined;

		const whereClause = projectId
			? { OR: [{ projectId }, { projectId: null }] }
			: { projectId: null };

		const rubrics = await prisma.rubric.findMany({
			where: whereClause,
			include: { criteria: true },
			orderBy: { createdAt: "desc" },
		});

		res.json({ data: rubrics });
	} catch (error) {
		console.error("Error getting rubrics:", error);
		res.status(500).json({ error: "Error al obtener rúbricas" });
	}
});

// POST crear Rúbrica - ADMIN only
router.post(
	"/",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const parsed = rubricCreateSchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Datos inválidos" });
			}

			const { projectId, name, description, criteria } = parsed.data;

			const rubric = await prisma.rubric.create({
				data: {
					projectId: projectId || null,
					name,
					description,
					criteria: {
						create: criteria.map((c) => ({
							name: c.name,
							maxScore: Number(c.maxScore) || 10,
							weight: Number(c.weight) || 1,
						})),
					},
				},
				include: { criteria: true },
			});

			res.status(201).json({ data: rubric });
		} catch (error) {
			console.error("Error creating rubric:", error);
			res.status(500).json({ error: "Error al crear rúbrica" });
		}
	},
);

// PUT actualizar Rúbrica - ADMIN only
router.put(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { name, description, criteria } = req.body;

			if (!name || !criteria || !Array.isArray(criteria)) {
				return res.status(400).json({ error: "Datos inválidos" });
			}

			const updatedRubric = await prisma.$transaction(async (tx) => {
				await tx.rubric.update({
					where: { id },
					data: { name, description },
				});

				const existingCriteria = await tx.criteria.findMany({
					where: { rubricId: id },
					select: { id: true },
				});
				const existingIds = existingCriteria.map((c) => c.id);

				const requestIds = criteria
					.filter((c: { id?: string }) => c.id && existingIds.includes(c.id))
					.map((c: { id?: string }) => c.id);

				const toDelete = existingIds.filter((id) => !requestIds.includes(id));
				if (toDelete.length > 0) {
					await tx.criteria.deleteMany({
						where: { id: { in: toDelete } },
					});
				}

				for (const c of criteria) {
					if (c.id && existingIds.includes(c.id)) {
						await tx.criteria.update({
							where: { id: c.id },
							data: {
								name: c.name,
								maxScore: Number(c.maxScore),
								weight: Number(c.weight),
							},
						});
					} else {
						await tx.criteria.create({
							data: {
								rubricId: id,
								name: c.name,
								maxScore: Number(c.maxScore) || 10,
								weight: Number(c.weight) || 1,
							},
						});
					}
				}

				return tx.rubric.findUnique({
					where: { id },
					include: { criteria: true },
				});
			});

			res.json({ data: updatedRubric });
		} catch (error) {
			console.error("Error updating rubric:", error);
			res.status(500).json({ error: "Error al actualizar rúbrica" });
		}
	},
);

// DELETE eliminar Rúbrica - ADMIN only
router.delete(
	"/:id",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { id } = req.params;
			await prisma.rubric.delete({
				where: { id },
			});
			res.json({ message: "Rúbrica eliminada" });
		} catch (error) {
			console.error("Error deleting rubric:", error);
			res.status(500).json({ error: "Error al eliminar rúbrica" });
		}
	},
);

export default router;
