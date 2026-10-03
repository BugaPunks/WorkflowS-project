import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

interface CriteriaScore {
	id: string;
	score: number;
	comment: string;
	criteria: { name: string; maxScore: number };
}

interface Evaluation {
	id: string;
	score: number;
	feedback: string;
	createdAt: string;
	project: { name: string };
	task?: { title: string };
	sprint?: { name: string };
	evaluator: { name: string };
	criteria?: CriteriaScore[];
}

export default function MyEvaluations() {
	const { session: user } = useSession();
	const [myGrades, setMyGrades] = useState<Evaluation[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const loadData = useCallback(async () => {
		if (!user) return;
		setIsLoading(true);
		try {
			const res = await fetch(`/api/evaluations/student/${user.id}`);
			const data = await res.json();
			setMyGrades(data.data || []);
		} catch (error) {
			console.error("Error loading grades:", error);
		} finally {
			setIsLoading(false);
		}
	}, [user]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
					<p className="text-gray-600 mt-4">Cargando evaluaciones...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<h1 className="text-3xl font-bold text-gray-900 mb-6">
				Mis Calificaciones
			</h1>

			<div className="space-y-4">
				{myGrades.length === 0 ? (
					<div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
						<p className="text-gray-500">
							Aún no tienes calificaciones registradas.
						</p>
					</div>
				) : (
					myGrades.map((grade) => (
						<div
							key={grade.id}
							className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-500"
						>
							<div className="flex justify-between items-start">
								<div>
									<h3 className="font-bold text-lg text-gray-900">
										{grade.task?.title ||
											grade.sprint?.name ||
											"Proyecto Final"}
									</h3>
									<div className="flex items-center gap-2 mt-1">
										<span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
											{grade.task
												? "Tarea"
												: grade.sprint
													? "Sprint"
													: "Proyecto"}
										</span>
										<span className="text-sm text-gray-600">
											{grade.project.name}
										</span>
									</div>
									<p className="mt-3 text-gray-700 italic bg-gray-50 p-3 rounded border border-gray-100">
										"{grade.feedback || "Sin comentarios"}"
									</p>
									<p className="text-xs text-gray-400 mt-2">
										Evaluado por {grade.evaluator.name} •{" "}
										{new Date(grade.createdAt).toLocaleDateString()}
									</p>

									{grade.criteria && grade.criteria.length > 0 && (
										<div className="mt-4 pt-4 border-t border-dashed border-gray-200">
											<h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
												Detalle de Rúbrica
											</h4>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
												{grade.criteria.map((c) => (
													<div
														key={c.id}
														className="bg-gray-50 rounded p-2 text-sm"
													>
														<div className="flex justify-between font-medium">
															<span>{c.criteria.name}</span>
															<span>
																{c.score}/{c.criteria.maxScore}
															</span>
														</div>
														{c.comment && (
															<p className="text-xs text-gray-500 mt-1 italic">
																"{c.comment}"
															</p>
														)}
													</div>
												))}
											</div>
										</div>
									)}
								</div>
								<div className="text-right flex flex-col items-center justify-center bg-blue-50 p-3 rounded-lg min-w-[80px]">
									<span className="block text-3xl font-bold text-blue-600">
										{grade.score}
									</span>
									<span className="text-xs text-blue-400 font-medium">
										/ 100
									</span>
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
