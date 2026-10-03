import { Router } from "express";
import { prisma } from "../db";
import {
	computeBurndown,
	computeContribution,
	computeVelocity,
} from "../lib/metrics";
import { authenticateToken } from "../middleware/auth";
import { requireSystemRole } from "../middleware/system-rbac";

const router = Router();

const sanitizeCsvCell = (value: string): string => {
	const dangerous = ["=", "+", "-", "@", "\t", "\n"];
	if (dangerous.some((c) => value.startsWith(c))) {
		return `'${value}`;
	}
	return value;
};

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

			const project = await prisma.project.findUnique({
				where: { id: projectId },
				include: {
					sprints: {
						include: {
							tasks: {
								include: {
									assignee: true,
								},
							},
						},
					},
				},
			});

			if (!project) {
				return res.status(404).json({ error: "Project not found" });
			}

			const rows = ["Sprint,Tarea,Asignado,Estado,Prioridad,Puntos"];

			project.sprints.forEach((sprint) => {
				sprint.tasks.forEach((task) => {
					rows.push(
						`${sanitizeCsvCell(sprint.name)},"${sanitizeCsvCell(task.title)}",${sanitizeCsvCell(task.assignee?.name || "Sin asignar")},${task.status},${task.priority},N/A`,
					);
				});
			});

			const csvContent = rows.join("\n");

			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="project-${projectId}-report.csv"`,
			);
			res.send(csvContent);
		} catch (error) {
			console.error("Error exporting data:", error);
			res.status(500).json({ error: "Error exporting data" });
		}
	},
);

export default router;
