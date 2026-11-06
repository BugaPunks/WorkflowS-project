import {
	AlertCircle,
	BarChart2,
	Calendar,
	CheckCircle2,
	Clock,
	Flame,
	ListChecks,
	TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
	Area,
	Bar,
	BarChart,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { apiFetch } from "@/api/config";
import { useSession } from "@/hooks/useSession";

interface UserStorySummary {
	id: string;
	title: string;
	description?: string;
	storyPoints?: number | null;
	status?: string;
	priority?: string;
	completedAt?: string | null;
}

interface BurndownDataPoint {
	day: number;
	date: string;
	ideal: number;
	actual: number | null;
}

interface BurndownData {
	totalPoints: number;
	unestimated: number;
	series: BurndownDataPoint[];
}

interface VelocityItem {
	name: string;
	committed: number;
	completed: number;
	unestimated: number;
}

// Generic type for what we are grading
interface TargetEntity {
	id: string;
	title: string; // For Task/Sprint
	name?: string; // For Sprint/Project (will normalize to title)
	description: string | null;
	status?: string;
	assignee?: {
		id: string;
		name: string;
	};
	projectId: string;
	startDate?: string | null;
	endDate?: string | null;
	userStories?: UserStorySummary[];
}

interface Criteria {
	id: string;
	name: string;
	maxScore: number;
	weight: number;
}

interface Rubric {
	id: string;
	name: string;
	description?: string;
	criteria: Criteria[];
}

interface Score {
	criteriaId: string;
	score: number;
	comment: string;
}

function formatDate(dateStr?: string | null) {
	if (!dateStr) return "-";
	try {
		const d = new Date(dateStr);
		return d.toLocaleDateString("es-ES", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

function getPriorityBadge(priority?: string) {
	switch (priority) {
		case "CRITICAL":
			return (
				<span className="px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700 rounded-full">
					Crítica
				</span>
			);
		case "HIGH":
			return (
				<span className="px-2 py-0.5 text-[11px] font-medium bg-orange-100 text-orange-700 rounded-full">
					Alta
				</span>
			);
		case "MEDIUM":
			return (
				<span className="px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 rounded-full">
					Media
				</span>
			);
		case "LOW":
			return (
				<span className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-700 rounded-full">
					Baja
				</span>
			);
		default:
			return (
				<span className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-700 rounded-full">
					{priority || "Normal"}
				</span>
			);
	}
}

function getStatusBadge(status?: string) {
	const isDone = status === "COMPLETED" || status === "DONE";
	const isInProgress = status === "IN_PROGRESS";
	if (isDone) {
		return (
			<span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-green-100 text-green-700 rounded-full">
				<CheckCircle2 size={12} />
				Completada
			</span>
		);
	}
	if (isInProgress) {
		return (
			<span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 rounded-full">
				<Clock size={12} />
				En progreso
			</span>
		);
	}
	return (
		<span className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-700 rounded-full">
			{status || "Pendiente"}
		</span>
	);
}

export default function GradingView() {
	// Allow params for Task, Sprint, or just Project
	const { projectId, taskId, sprintId } = useParams<{
		projectId: string;
		taskId?: string;
		sprintId?: string;
	}>();
	const navigate = useNavigate();
	const { session: user } = useSession();

	const [target, setTarget] = useState<TargetEntity | null>(null);
	const [rubrics, setRubrics] = useState<Rubric[]>([]);
	const [selectedRubric, setSelectedRubric] = useState<Rubric | null>(null);
	const [scores, setScores] = useState<Score[]>([]);
	const [overallFeedback, setOverallFeedback] = useState("");
	const [existingEvaluationId, setExistingEvaluationId] = useState<
		string | null
	>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [burndownData, setBurndownData] = useState<BurndownData | null>(null);
	const [velocityData, setVelocityData] = useState<VelocityItem[]>([]);
	const [projectStories, setProjectStories] = useState<UserStorySummary[]>([]);

	const initializeScores = useCallback((rubric: Rubric) => {
		const initialScores = rubric.criteria.map((c) => ({
			criteriaId: c.id,
			score: 0,
			comment: "",
		}));
		setScores(initialScores);
	}, []);

	useEffect(() => {
		if (!projectId) return;

		const fetchData = async () => {
			try {
				setIsLoading(true);
				let targetData: TargetEntity | null = null;

				if (taskId) {
					const res = await apiFetch(`/tasks/${taskId}`);
					const data = await res.json();
					if (data.error) throw new Error(data.error);
					// Normalizing task data
					const task = data.data || data;
					targetData = { ...task, projectId };
				} else if (sprintId) {
					// Fetch Sprint
					// Assuming we have /api/sprints/:id
					const res = await apiFetch(`/sprints/${sprintId}`);
					// Sprint endpoint might return the object directly or wrapped
					const data = await res.json();
					const sprint = data.data || data;
					if (sprint.error) throw new Error(sprint.error);
					targetData = {
						id: sprint.id,
						title: sprint.name, // Normalize name to title
						description: sprint.description,
						status: sprint.status,
						projectId: sprint.projectId,
						startDate: sprint.startDate,
						endDate: sprint.endDate,
						userStories: sprint.userStories || [],
					};

					// Load Burndown
					try {
						const bRes = await apiFetch(
							`/metrics/sprints/${sprintId}/burndown`,
						);
						if (bRes.ok) {
							const bData = await bRes.json();
							setBurndownData(bData.data || null);
						}
					} catch (e) {
						console.error("Error loading burndown:", e);
					}

					// Load Velocity
					try {
						const vRes = await apiFetch(
							`/metrics/projects/${projectId}/velocity`,
						);
						if (vRes.ok) {
							const vData = await vRes.json();
							setVelocityData(vData.data || []);
						}
					} catch (e) {
						console.error("Error loading velocity:", e);
					}
				} else {
					// Grading Project
					const res = await apiFetch(`/projects/${projectId}`);
					const data = await res.json();
					const project = data.data || data;
					if (data.error) throw new Error(data.error);
					targetData = {
						id: project.id,
						title: project.name,
						description: project.description,
						status: project.status,
						projectId: project.id, // Self
					};

					// Load Velocity for project
					try {
						const vRes = await apiFetch(
							`/metrics/projects/${projectId}/velocity`,
						);
						if (vRes.ok) {
							const vData = await vRes.json();
							setVelocityData(vData.data || []);
						}
					} catch (e) {
						console.error("Error loading velocity:", e);
					}

					// Load Project User Stories
					try {
						const uRes = await apiFetch(`/user-stories?projectId=${projectId}`);
						if (uRes.ok) {
							const uData = await uRes.json();
							setProjectStories(uData.data || []);
						}
					} catch (e) {
						console.error("Error loading project stories:", e);
					}
				}

				setTarget(targetData);

				// Fetch Project Rubrics (Global + Project Specific)
				const rubricsRes = await apiFetch(`/rubrics?projectId=${projectId}`);
				const rubricsData = await rubricsRes.json();
				const rubricsList = rubricsData.data || [];
				setRubrics(rubricsList);

				// Check if an evaluation already exists for this task/sprint/project
				interface ExistingCriteria {
					criteriaId: string;
					score: number;
					comment?: string | null;
				}
				interface ExistingEval {
					id: string;
					feedback?: string | null;
					criteria?: ExistingCriteria[];
				}
				let existingEval: ExistingEval | null = null;
				try {
					if (taskId) {
						const evalRes = await apiFetch(`/evaluations/task/${taskId}`);
						if (evalRes.ok) {
							const evalData = await evalRes.json();
							if (evalData.data && evalData.data.length > 0) {
								existingEval = evalData.data[0];
							}
						}
					} else if (sprintId) {
						const evalRes = await apiFetch(`/evaluations/sprint/${sprintId}`);
						if (evalRes.ok) {
							const evalData = await evalRes.json();
							if (evalData.data && evalData.data.length > 0) {
								existingEval = evalData.data[0];
							}
						}
					} else if (projectId) {
						const evalRes = await apiFetch(
							`/evaluations/project/${projectId}/general`,
						);
						if (evalRes.ok) {
							const evalData = await evalRes.json();
							if (evalData.data && evalData.data.length > 0) {
								existingEval = evalData.data[0];
							}
						}
					}
				} catch (e) {
					console.error("Error loading existing evaluation:", e);
				}

				if (existingEval) {
					setExistingEvaluationId(existingEval.id);
					if (existingEval.feedback) {
						setOverallFeedback(existingEval.feedback);
					}
				} else {
					setExistingEvaluationId(null);
				}

				// Select first rubric by default if available and populate scores
				if (rubricsList.length > 0) {
					const initialRubric = rubricsList[0];
					setSelectedRubric(initialRubric);
					if (existingEval?.criteria && existingEval.criteria.length > 0) {
						const existingCriteria = existingEval.criteria;
						const loadedScores = initialRubric.criteria.map((c: Criteria) => {
							const match = existingCriteria.find(
								(ec: ExistingCriteria) => ec.criteriaId === c.id,
							);
							return {
								criteriaId: c.id,
								score: match
									? Math.max(0, Math.min(c.maxScore, match.score))
									: 0,
								comment: match?.comment || "",
							};
						});
						setScores(loadedScores);
					} else {
						initializeScores(initialRubric);
					}
				}
			} catch (error) {
				console.error("Error loading grading data:", error);
				alert("Error al cargar datos de calificación");
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [projectId, taskId, sprintId, initializeScores]);

	const handleRubricChange = (rubricId: string) => {
		const rubric = rubrics.find((r) => r.id === rubricId);
		if (rubric) {
			setSelectedRubric(rubric);
			initializeScores(rubric);
		}
	};

	const handleScoreChange = (
		criteriaId: string,
		value: number,
		maxScore?: number,
	) => {
		const clampedValue =
			typeof maxScore === "number"
				? Math.max(0, Math.min(maxScore, value))
				: Math.max(0, value);

		setScores((prev) =>
			prev.map((s) =>
				s.criteriaId === criteriaId ? { ...s, score: clampedValue } : s,
			),
		);
	};

	const handleCommentChange = (criteriaId: string, value: string) => {
		setScores((prev) =>
			prev.map((s) =>
				s.criteriaId === criteriaId ? { ...s, comment: value } : s,
			),
		);
	};

	const calculateTotalScore = () => {
		if (!selectedRubric) return 0;

		let totalWeight = 0;
		let weightedSum = 0;

		selectedRubric.criteria.forEach((c) => {
			const scoreEntry = scores.find((s) => s.criteriaId === c.id);
			const score = scoreEntry?.score || 0;
			const clampedScore = Math.max(0, Math.min(c.maxScore, score));
			// Normalize score to 0-1 ratio then multiply by weight
			weightedSum += (clampedScore / c.maxScore) * c.weight;
			totalWeight += c.weight;
		});

		if (totalWeight === 0) return 0;
		// Scale to 100
		return Math.min(
			100,
			Math.max(0, Math.round((weightedSum / totalWeight) * 100)),
		);
	};

	const handleSubmit = async () => {
		if (!selectedRubric || !user || !target || !projectId) return;

		// Validar que ningún criterio exceda su puntaje máximo o sea negativo
		for (const criterion of selectedRubric.criteria) {
			const scoreEntry = scores.find((s) => s.criteriaId === criterion.id);
			const scoreVal = scoreEntry?.score ?? 0;
			if (scoreVal < 0 || scoreVal > criterion.maxScore) {
				alert(
					`El puntaje para el criterio "${criterion.name}" (${scoreVal}) no puede exceder el puntaje máximo (${criterion.maxScore}) ni ser menor a 0.`,
				);
				return;
			}
		}

		try {
			setIsSaving(true);
			const finalScore = calculateTotalScore();

			if (existingEvaluationId) {
				const response = await apiFetch(
					`/evaluations/${existingEvaluationId}`,
					{
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							feedback: overallFeedback,
							criteriaScores: scores,
							score: finalScore,
						}),
					},
				);

				if (!response.ok) throw new Error("Error updating evaluation");

				alert("Calificación actualizada exitosamente");
				navigate(-1);
				return;
			}

			interface EvaluationPayload {
				projectId: string;
				evaluatorId: string;
				feedback: string;
				criteriaScores: Score[];
				score: number;
				taskId?: string;
				sprintId?: string;
			}

			const payload: EvaluationPayload = {
				projectId,
				evaluatorId: user.id,
				feedback: overallFeedback,
				criteriaScores: scores,
				score: finalScore,
			};

			if (taskId) payload.taskId = taskId;
			if (sprintId) payload.sprintId = sprintId;
			// If both missing, it's project level (handled by backend)

			const response = await apiFetch("/evaluations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) throw new Error("Error saving evaluation");

			alert("Calificación guardada exitosamente");
			navigate(-1); // Go back
		} catch (error) {
			console.error("Error saving evaluation:", error);
			alert(
				existingEvaluationId
					? "Error al actualizar la calificación"
					: "Error al guardar la calificación",
			);
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full min-h-[400px]">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950" />
			</div>
		);
	}

	if (!target) {
		return (
			<div className="p-8 text-center text-red-600">Elemento no encontrado</div>
		);
	}

	const getTypeName = () => {
		if (taskId) return "Entrega (Tarea)";
		if (sprintId) return "Sprint";
		return "Proyecto Final";
	};

	const sprintStories = target.userStories || [];
	const totalStoriesCount = sprintStories.length;
	const completedStoriesCount = sprintStories.filter(
		(s) => s.status === "COMPLETED" || s.status === "DONE",
	).length;
	const storiesPercentage =
		totalStoriesCount > 0
			? Math.round((completedStoriesCount / totalStoriesCount) * 100)
			: 0;

	const totalStoryPoints = sprintStories.reduce(
		(sum, s) => sum + (s.storyPoints || 0),
		0,
	);
	const completedStoryPoints = sprintStories
		.filter((s) => s.status === "COMPLETED" || s.status === "DONE")
		.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
	const pointsPercentage =
		totalStoryPoints > 0
			? Math.round((completedStoryPoints / totalStoryPoints) * 100)
			: 0;

	const unestimatedCount = sprintStories.filter(
		(s) => s.storyPoints === null || s.storyPoints === undefined,
	).length;

	const projectCompletedStories = projectStories.filter(
		(s) => s.status === "COMPLETED" || s.status === "DONE",
	).length;
	const projectTotalPoints = projectStories.reduce(
		(sum, s) => sum + (s.storyPoints || 0),
		0,
	);
	const projectCompletedPoints = projectStories
		.filter((s) => s.status === "COMPLETED" || s.status === "DONE")
		.reduce((sum, s) => sum + (s.storyPoints || 0), 0);

	return (
		<div className="flex h-[calc(100vh-64px)] overflow-hidden">
			{/* Left Panel: Context Viewer */}
			<div className="w-1/2 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto">
				<div className="bg-white p-8 shadow-sm rounded-lg min-h-full">
					<div className="mb-6">
						<h1 className="text-2xl font-bold text-gray-900 mb-2">
							{existingEvaluationId ? "Editar Calificación de" : "Calificar"}{" "}
							{getTypeName()}
						</h1>
						<p className="text-sm text-gray-500">
							Proyecto: {projectId}
							{target.assignee && (
								<>
									{" "}
									• Asignado a:{" "}
									<span className="font-medium text-gray-900">
										{target.assignee.name}
									</span>
								</>
							)}
						</p>
					</div>

					<div className="mb-8">
						<h2 className="text-lg font-semibold text-gray-800 mb-2">
							{target.title}
						</h2>
						<div className="prose prose-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100">
							{target.description || "Sin descripción disponible."}
						</div>
					</div>

					{taskId && (
						<div className="border-t border-gray-200 pt-6">
							<h3 className="font-medium text-gray-900 mb-4">
								Archivos Adjuntos
							</h3>
							<div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
								<svg
									className="w-12 h-12 text-gray-400 mx-auto mb-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-label="Document Icon"
								>
									<title>Document Icon</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								<p className="text-gray-500 font-medium">
									Documento de la entrega.pdf
								</p>
								<button
									type="button"
									className="mt-4 text-blue-950 text-sm font-medium hover:underline"
								>
									Descargar Archivo
								</button>
							</div>
						</div>
					)}

					{!taskId && (
						<div className="border-t border-gray-200 pt-6 space-y-6">
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
									<TrendingUp className="w-5 h-5 text-blue-950" />
									Resumen de Actividad
								</h3>
								{sprintId && target.status && (
									<span
										className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
											target.status === "COMPLETED" || target.status === "DONE"
												? "bg-green-100 text-green-800"
												: target.status === "ACTIVE"
													? "bg-blue-100 text-blue-800"
													: "bg-gray-100 text-gray-700"
										}`}
									>
										{target.status}
									</span>
								)}
							</div>

							{sprintId && (
								<>
									{/* Sprint Date range */}
									{(target.startDate || target.endDate) && (
										<div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
											<Calendar className="w-4 h-4 text-gray-400" />
											<span>Periodo del Sprint:</span>
											<span className="font-medium text-gray-800">
												{formatDate(target.startDate)} -{" "}
												{formatDate(target.endDate)}
											</span>
										</div>
									)}

									{/* KPI Cards Grid */}
									<div className="grid grid-cols-2 gap-3">
										{/* User Stories KPI */}
										<div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
											<div className="flex items-center justify-between mb-1">
												<span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
													<ListChecks className="w-3.5 h-3.5 text-blue-950" />
													Historias de Usuario
												</span>
												<span className="text-xs font-bold text-gray-700">
													{storiesPercentage}%
												</span>
											</div>
											<div className="text-xl font-bold text-gray-900 mb-1.5">
												{completedStoriesCount}{" "}
												<span className="text-xs font-normal text-gray-500">
													/ {totalStoriesCount} completadas
												</span>
											</div>
											<div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
												<div
													className="bg-blue-950 h-full rounded-full transition-all duration-300"
													style={{ width: `${storiesPercentage}%` }}
												/>
											</div>
										</div>

										{/* Story Points KPI */}
										<div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
											<div className="flex items-center justify-between mb-1">
												<span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
													<Flame className="w-3.5 h-3.5 text-amber-600" />
													Puntos de Historia
												</span>
												<span className="text-xs font-bold text-gray-700">
													{pointsPercentage}%
												</span>
											</div>
											<div className="text-xl font-bold text-gray-900 mb-1.5">
												{completedStoryPoints}{" "}
												<span className="text-xs font-normal text-gray-500">
													/ {totalStoryPoints} pts
												</span>
											</div>
											<div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
												<div
													className="bg-amber-600 h-full rounded-full transition-all duration-300"
													style={{ width: `${pointsPercentage}%` }}
												/>
											</div>
											{unestimatedCount > 0 && (
												<p className="text-[11px] text-amber-700 mt-1">
													{unestimatedCount} historia
													{unestimatedCount > 1 ? "s" : ""} sin estimar
												</p>
											)}
										</div>
									</div>

									{/* Burn-down Chart Card */}
									<div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
										<div className="flex items-center justify-between mb-3">
											<div>
												<h4 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
													<TrendingUp className="w-4 h-4 text-blue-950" />
													Burn-down Chart
												</h4>
												<p className="text-xs text-gray-500">
													Puntos ideales vs restantes día a día
												</p>
											</div>
											<div className="text-right">
												<span className="text-xs text-gray-500">
													Puntos Totales:{" "}
												</span>
												<span className="text-sm font-bold text-gray-900">
													{burndownData?.totalPoints ?? totalStoryPoints}
												</span>
											</div>
										</div>

										{burndownData?.series && burndownData.series.length > 0 ? (
											<div className="h-64 w-full">
												<ResponsiveContainer width="100%" height="100%">
													<ComposedChart
														data={burndownData.series}
														margin={{
															top: 10,
															right: 10,
															left: -20,
															bottom: 0,
														}}
													>
														<CartesianGrid
															strokeDasharray="3 3"
															vertical={false}
															stroke="#f0f0f0"
														/>
														<XAxis
															dataKey="date"
															tick={{ fontSize: 11, fill: "#6b7280" }}
														/>
														<YAxis
															tick={{ fontSize: 11, fill: "#6b7280" }}
															allowDecimals={false}
														/>
														<Tooltip
															contentStyle={{
																fontSize: 12,
																borderRadius: 8,
																boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
															}}
														/>
														<Legend
															wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
														/>
														<Line
															type="monotone"
															dataKey="ideal"
															stroke="#9ca3af"
															name="Ideal (Restante)"
															strokeDasharray="5 5"
															strokeWidth={2}
															dot={false}
														/>
														<Area
															type="monotone"
															dataKey="actual"
															fill="#3b82f6"
															stroke="#1d4ed8"
															name="Real (Restante)"
															fillOpacity={0.25}
															strokeWidth={2}
														/>
													</ComposedChart>
												</ResponsiveContainer>
											</div>
										) : (
											<div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3.5 rounded-lg flex items-start gap-2.5">
												<AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
												<div>
													<p className="font-semibold">
														Sin datos suficientes para el gráfico
													</p>
													<p className="mt-0.5 text-amber-700">
														Para visualizar la curva burn-down, el sprint debe
														tener fechas de inicio y fin configuradas e
														historias de usuario asignadas con estimación de
														puntos.
													</p>
												</div>
											</div>
										)}
									</div>

									{/* User Stories Table/List */}
									<div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
										<h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
											<ListChecks className="w-4 h-4 text-blue-950" />
											Historias de Usuario del Sprint ({totalStoriesCount})
										</h4>
										{sprintStories.length > 0 ? (
											<div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
												{sprintStories.map((story) => (
													<div
														key={story.id}
														className="py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-gray-50 px-1 rounded transition-colors"
													>
														<div className="flex-1 min-w-0">
															<p className="font-medium text-gray-900 truncate">
																{story.title}
															</p>
														</div>
														<div className="flex items-center gap-2 shrink-0">
															<span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
																{story.storyPoints !== null &&
																story.storyPoints !== undefined
																	? `${story.storyPoints} pts`
																	: "Sin estimar"}
															</span>
															{getPriorityBadge(story.priority)}
															{getStatusBadge(story.status)}
														</div>
													</div>
												))}
											</div>
										) : (
											<p className="text-xs text-gray-500 italic py-2">
												No hay historias de usuario asignadas a este sprint.
											</p>
										)}
									</div>
								</>
							)}

							{!sprintId && (
								<>
									{/* Project Level Summary */}
									<div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
										<div className="flex items-center justify-between mb-3">
											<div>
												<h4 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
													<BarChart2 className="w-4 h-4 text-blue-950" />
													Velocidad del Equipo por Sprint
												</h4>
												<p className="text-xs text-gray-500">
													Puntos comprometidos vs completados en cada sprint
												</p>
											</div>
										</div>

										{velocityData.length > 0 ? (
											<div className="h-64 w-full">
												<ResponsiveContainer width="100%" height="100%">
													<BarChart
														data={velocityData}
														margin={{
															top: 10,
															right: 10,
															left: -20,
															bottom: 0,
														}}
													>
														<CartesianGrid
															strokeDasharray="3 3"
															vertical={false}
															stroke="#f0f0f0"
														/>
														<XAxis
															dataKey="name"
															tick={{ fontSize: 11, fill: "#6b7280" }}
														/>
														<YAxis
															tick={{ fontSize: 11, fill: "#6b7280" }}
															allowDecimals={false}
														/>
														<Tooltip
															contentStyle={{
																fontSize: 12,
																borderRadius: 8,
																boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
															}}
														/>
														<Legend
															wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
														/>
														<Bar
															dataKey="committed"
															fill="#9ca3af"
															name="Comprometido (Pts)"
															radius={[4, 4, 0, 0]}
														/>
														<Bar
															dataKey="completed"
															fill="#1e3a8a"
															name="Completado (Pts)"
															radius={[4, 4, 0, 0]}
														/>
													</BarChart>
												</ResponsiveContainer>
											</div>
										) : (
											<p className="text-xs text-gray-500 italic py-4 text-center">
												No hay datos de velocidad disponibles para este
												proyecto.
											</p>
										)}
									</div>

									{/* Project Stories Summary */}
									<div className="grid grid-cols-2 gap-3">
										<div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
											<span className="text-xs font-medium text-gray-500">
												Total Historias
											</span>
											<p className="text-2xl font-bold text-gray-900 mt-1">
												{projectStories.length}
											</p>
											<p className="text-xs text-gray-500 mt-0.5">
												{projectCompletedStories} completadas
											</p>
										</div>
										<div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
											<span className="text-xs font-medium text-gray-500">
												Puntos Totales
											</span>
											<p className="text-2xl font-bold text-gray-900 mt-1">
												{projectTotalPoints} pts
											</p>
											<p className="text-xs text-gray-500 mt-0.5">
												{projectCompletedPoints} pts completados
											</p>
										</div>
									</div>
								</>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Right Panel: Grading Rubric */}
			<div className="w-1/2 bg-white p-6 overflow-y-auto">
				<div className="max-w-xl mx-auto">
					<div className="flex justify-between items-center mb-6">
						<h2 className="text-xl font-bold text-gray-900">
							Rúbrica de Evaluación
						</h2>
						{rubrics.length > 0 && (
							<select
								id="rubric-select"
								className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-700 focus:ring-blue-700"
								value={selectedRubric?.id || ""}
								onChange={(e) => handleRubricChange(e.target.value)}
							>
								{rubrics.map((r) => (
									<option key={r.id} value={r.id}>
										{r.name}
									</option>
								))}
							</select>
						)}
					</div>

					{existingEvaluationId && (
						<div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-center gap-2">
							<svg
								className="w-5 h-5 flex-shrink-0 text-amber-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<title>Aviso de edición</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>
								<strong>Modo Edición:</strong> Modificando la calificación
								previa. Al guardar se actualizarán los puntajes y comentarios
								existentes.
							</span>
						</div>
					)}

					{!selectedRubric ? (
						<div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
							No hay rúbricas disponibles para este proyecto.
							<br />
							Cree una rúbrica en la sección de Rúbricas.
						</div>
					) : (
						<div className="space-y-6 pb-24">
							{selectedRubric.criteria.map((criterion) => {
								const currentScore = scores.find(
									(s) => s.criteriaId === criterion.id,
								);
								return (
									<div
										key={criterion.id}
										className="border border-gray-200 rounded-lg p-5 shadow-sm"
									>
										<div className="flex justify-between items-start mb-3">
											<div>
												<h3 className="font-semibold text-gray-900">
													{criterion.name}
												</h3>
												<p className="text-xs text-gray-500 mt-1">
													Peso: {criterion.weight} • Max: {criterion.maxScore}{" "}
													pts
												</p>
											</div>
											<div className="flex items-center gap-2">
												<input
													type="number"
													min="0"
													max={criterion.maxScore}
													value={currentScore?.score ?? 0}
													onChange={(e) => {
														const val = parseInt(e.target.value, 10);
														if (Number.isNaN(val) || val < 0) {
															handleScoreChange(
																criterion.id,
																0,
																criterion.maxScore,
															);
														} else if (val > criterion.maxScore) {
															handleScoreChange(
																criterion.id,
																criterion.maxScore,
																criterion.maxScore,
															);
														} else {
															handleScoreChange(
																criterion.id,
																val,
																criterion.maxScore,
															);
														}
													}}
													onBlur={(e) => {
														const val = parseInt(e.target.value, 10);
														if (Number.isNaN(val) || val < 0) {
															handleScoreChange(
																criterion.id,
																0,
																criterion.maxScore,
															);
														} else if (val > criterion.maxScore) {
															handleScoreChange(
																criterion.id,
																criterion.maxScore,
																criterion.maxScore,
															);
														}
													}}
													className="w-16 px-2 py-1 text-right border border-gray-300 rounded-md focus:ring-blue-700 focus:border-blue-700 font-mono font-medium"
												/>
												<span className="text-gray-400 text-sm">
													/ {criterion.maxScore}
												</span>
											</div>
										</div>

										<div className="mt-3">
											<label
												htmlFor={`feedback-${criterion.id}`}
												className="block text-xs font-medium text-gray-500 mb-1 uppercase"
											>
												Feedback:
											</label>
											<textarea
												id={`feedback-${criterion.id}`}
												value={currentScore?.comment || ""}
												onChange={(e) =>
													handleCommentChange(criterion.id, e.target.value)
												}
												placeholder={`Comentarios sobre ${criterion.name}...`}
												className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:ring-blue-700 focus:border-blue-700 bg-gray-50"
												rows={2}
											/>
										</div>
									</div>
								);
							})}

							<div className="border-t border-gray-200 pt-6 mt-8">
								<h3 className="font-bold text-gray-900 mb-3">
									Comentarios Generales
								</h3>
								<textarea
									value={overallFeedback}
									onChange={(e) => setOverallFeedback(e.target.value)}
									placeholder="Proporcione un feedback general sobre el trabajo..."
									className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-700 focus:border-blue-700"
									rows={4}
								/>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Fixed Footer for Action */}
			<div className="fixed bottom-0 right-0 w-1/2 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
				<div className="max-w-xl mx-auto flex justify-between items-center">
					<div className="flex flex-col">
						<span className="text-sm text-gray-500">Calificación Final</span>
						<span className="text-3xl font-bold text-blue-950">
							{calculateTotalScore()}{" "}
							<span className="text-lg text-gray-400 font-normal">/ 100</span>
						</span>
					</div>
					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => navigate(-1)}
							className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition"
						>
							Cancelar
						</button>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={isSaving || !selectedRubric}
							className="px-6 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-900 font-medium shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSaving
								? "Guardando..."
								: existingEvaluationId
									? "Actualizar Calificación"
									: "Guardar Calificación"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
