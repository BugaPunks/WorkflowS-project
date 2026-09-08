import { Router } from "express";
import { prisma } from "../db";
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

			const totalPoints = sprint.userStories.reduce(
				(acc, item) => acc + (item.storyPoints || 0),
				0,
			);

			if (!sprint.startDate || !sprint.endDate) {
				return res.json({ data: { totalPoints, series: [] } });
			}

			const start = new Date(sprint.startDate);
			const end = new Date(sprint.endDate);
			const daysDiff = Math.ceil(
				(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
			);

			const series = [];

			const completedItems = sprint.userStories
				.filter((item) => item.completedAt !== null)
				.map((item) => ({
					points: item.storyPoints || 0,
					date: new Date(item.completedAt as Date),
				}));

			const idealDecrement = totalPoints / daysDiff;

			for (let i = 0; i <= daysDiff; i++) {
				const currentDate = new Date(start);
				currentDate.setDate(start.getDate() + i);

				const burnedSoFar = completedItems
					.filter((item) => item.date <= currentDate)
					.reduce((acc, item) => acc + item.points, 0);

				const actualRemaining = totalPoints - burnedSoFar;
				const idealRemaining = Math.max(0, totalPoints - idealDecrement * i);

				const isFuture = currentDate > new Date();

				series.push({
					day: i,
					date: currentDate.toISOString().split("T")[0],
					ideal: idealRemaining,
					actual: isFuture ? null : actualRemaining,
				});
			}

			res.json({ data: { totalPoints, series } });
		} catch (error) {
			console.error("Error fetching burndown:", error);
			res.status(500).json({ error: "Error calculating metrics" });
		}
	},
);

// GET Individual Contribution - any authenticated
router.get(
	"/projects/:projectId/contribution",
	authenticateToken,
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

			const contributionMap = new Map<
				string,
				{ user: { id: string; name: string }; count: number }
			>();

			tasks.forEach((task) => {
				if (!task.assignee) return;

				const userId = task.assignee.id;
				if (!contributionMap.has(userId)) {
					contributionMap.set(userId, { user: task.assignee, count: 0 });
				}

				const entry = contributionMap.get(userId);
				if (entry) entry.count += 1;
			});

			const data = Array.from(contributionMap.values()).sort(
				(a, b) => b.count - a.count,
			);

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

			const velocityData = sprints.map((sprint) => {
				const committed = sprint.userStories.reduce(
					(acc, item) => acc + (item.storyPoints || 0),
					0,
				);
				const completed = sprint.userStories
					.filter((item) => item.completedAt !== null)
					.reduce((acc, item) => acc + (item.storyPoints || 0), 0);

				return {
					name: sprint.name,
					committed,
					completed,
				};
			});

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
