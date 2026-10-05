import { Router } from "express";
import { prisma } from "../db";
import { buildProjectReportCsv, projectReportFileName } from "../lib/csv";
import {
	computeBurndown,
	computeContribution,
	computeVelocity,
} from "../lib/metrics";
import { authenticateToken } from "../middleware/auth";
import { requireSystemRole } from "../middleware/system-rbac";

const router = Router();

// GET Burndown Data for a Sprint - any authenticated
router.get(
	"/sprints/:sprintId/burndown",
	authenticateToken,
	async (req, res) => {
		try {
			const { sprintId } = req.params;

			const sprint = await prisma.sprint.findUnique({
				where: { id: sprintId },
				include: {
					userStories: true,
				},
			});

			if (!sprint) {
				return res.status(404).json({ error: "Sprint not found" });
			}

			const metrics = computeBurndown(sprint);
			res.json({ data: metrics });
		} catch (error) {
			console.error("Error fetching burndown:", error);
			res.status(500).json({ error: "Error calculating metrics" });
		}
	},
);

// GET Individual Contribution - ADMIN only
router.get(
	"/projects/:projectId/contribution",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { projectId } = req.params;

			const tasks = await prisma.task.findMany({
				where: {
					projectId,
					status: "COMPLETED",
				},
				include: {
					assignee: {
						select: { id: true, name: true, email: true, avatar: true },
					},
				},
			});

			const data = computeContribution(tasks);
			res.json({ data });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Error fetching contributions" });
		}
	},
);

// GET Velocity - any authenticated
router.get(
	"/projects/:projectId/velocity",
	authenticateToken,
	async (req, res) => {
		try {
			const { projectId } = req.params;

			const sprints = await prisma.sprint.findMany({
				where: { projectId },
				include: {
					userStories: true,
				},
				orderBy: { startDate: "asc" },
			});

			const velocityData = computeVelocity(sprints);
			res.json({ data: velocityData });
		} catch (error) {
			console.error("Error fetching velocity:", error);
			res.status(500).json({ error: "Error fetching velocity data" });
		}
	},
);

// GET Export Project Data (CSV) - ADMIN only
router.get(
	"/export/projects/:projectId",
	authenticateToken,
	requireSystemRole("ADMIN"),
	async (req, res) => {
		try {
			const { projectId } = req.params;
			const sprintId =
				typeof req.query.sprintId === "string" && req.query.sprintId
					? req.query.sprintId
					: undefined;

			// `select` en lugar de `include`: el archivo solo necesita el nombre del
			// sprint, el título, estado y prioridad de la tarea y el nombre del
			// responsable. Con `include` se cargaba además el hash de contraseña.
			const project = await prisma.project.findUnique({
				where: { id: projectId },
				select: {
					sprints: {
						where: sprintId ? { id: sprintId } : undefined,
						select: {
							name: true,
							tasks: {
								select: {
									title: true,
									status: true,
									priority: true,
									assignee: { select: { name: true } },
								},
							},
						},
					},
				},
			});

			if (!project) {
				return res.status(404).json({ error: "Project not found" });
			}

			// Un sprint pedido que no aparece puede no existir o pertenecer a otro
			// proyecto. Se rechaza en lugar de devolver un archivo vacío, que el
			// docente tomaría por un informe completo del proyecto.
			if (sprintId && project.sprints.length === 0) {
				return res.status(400).json({
					error: "El sprint indicado no existe o no pertenece al proyecto",
				});
			}

			const rows = project.sprints.flatMap((sprint) =>
				sprint.tasks.map((task) => ({
					sprint: sprint.name,
					title: task.title,
					assignee: task.assignee?.name || "Sin asignar",
					status: task.status,
					priority: task.priority,
					points: "N/A",
				})),
			);

			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="${projectReportFileName(projectId)}"`,
			);
			res.send(buildProjectReportCsv(rows));
		} catch (error) {
			console.error("Error exporting data:", error);
			res.status(500).json({ error: "Error exporting data" });
		}
	},
);

export default router;
