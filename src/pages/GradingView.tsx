import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSession } from "@/hooks/useSession";

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
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

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
					const res = await fetch(`/api/tasks/${taskId}`);
					const data = await res.json();
					if (data.error) throw new Error(data.error);
					// Normalizing task data
					const task = data.data || data;
					targetData = { ...task, projectId };
				} else if (sprintId) {
					// Fetch Sprint
					// Assuming we have /api/sprints/:id
					const res = await fetch(`/api/sprints/${sprintId}`);
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
					};
				} else {
					// Grading Project
					const res = await fetch(`/api/projects/${projectId}`);
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
				}

				setTarget(targetData);

				// Fetch Project Rubrics (Global + Project Specific)
				const rubricsRes = await fetch(`/api/rubrics?projectId=${projectId}`);
				const rubricsData = await rubricsRes.json();
				const rubricsList = rubricsData.data || [];
				setRubrics(rubricsList);

				// Select first rubric by default if available
				if (rubricsList.length > 0) {
					const initialRubric = rubricsList[0];
					setSelectedRubric(initialRubric);
					initializeScores(initialRubric);
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

	const handleScoreChange = (criteriaId: string, value: number) => {
		setScores((prev) =>
			prev.map((s) =>
				s.criteriaId === criteriaId ? { ...s, score: value } : s,
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
			// Normalize score to 0-1 ratio then multiply by weight
			weightedSum += (score / c.maxScore) * c.weight;
			totalWeight += c.weight;
		});

		if (totalWeight === 0) return 0;
		// Scale to 100
		return Math.round((weightedSum / totalWeight) * 100);
	};

	const handleSubmit = async () => {
		if (!selectedRubric || !user || !target || !projectId) return;

		try {
			setIsSaving(true);
			const finalScore = calculateTotalScore();

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

			const response = await fetch("/api/evaluations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) throw new Error("Error saving evaluation");

			alert("Calificación guardada exitosamente");
			navigate(-1); // Go back
		} catch (error) {
			console.error("Error saving evaluation:", error);
			alert("Error al guardar la calificación");
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

	return (
		<div className="flex h-[calc(100vh-64px)] overflow-hidden">
			{/* Left Panel: Context Viewer */}
			<div className="w-1/2 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto">
				<div className="bg-white p-8 shadow-sm rounded-lg min-h-full">
					<div className="mb-6">
						<h1 className="text-2xl font-bold text-gray-900 mb-2">
							Calificar {getTypeName()}
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
						<div className="border-t border-gray-200 pt-6">
							<h3 className="font-medium text-gray-900 mb-4">
								Resumen de Actividad
							</h3>
							<div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm">
								Aquí se mostraría un resumen automático del{" "}
								{sprintId ? "Sprint" : "Proyecto"} (User Stories completadas,
								Velocity, Burn-down chart, etc.) para apoyar la evaluación.
							</div>
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
													value={currentScore?.score || 0}
													onChange={(e) =>
														handleScoreChange(
															criterion.id,
															parseInt(e.target.value, 10) || 0,
														)
													}
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
							{isSaving ? "Guardando..." : "Guardar Calificación"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
