import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sprintAPI } from "@/api/client";
import { useSession } from "@/hooks/useSession";

interface Evaluation {
	id: string;
	score: number;
	feedback: string;
	createdAt: string;
	project: { name: string };
	evaluator: { name: string };
}

interface PendingSprint {
	id: string;
	name: string;
	status: string;
	projectId: string;
	project: { name: string };
	evaluations: Evaluation[];
}

export default function Evaluations() {
	const { session: user } = useSession();
	const navigate = useNavigate();

	const [pendingSprints, setPendingSprints] = useState<PendingSprint[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const loadData = useCallback(async () => {
		if (!user) return;
		setIsLoading(true);
		try {
			// Admin-only route: load pending sprints (completed but not evaluated)
			const data = (await sprintAPI.getAll()) as PendingSprint[];

			// Filter: Status is COMPLETED and has no evaluations
			// Note: Ideally backend should filter, but for now we do client-side
			const pending = data.filter(
				(s) =>
					(s.status === "COMPLETED" || s.status === "CLOSED") &&
					(!s.evaluations || s.evaluations.length === 0),
			);
			setPendingSprints(pending);
		} catch (error) {
			console.error("Error loading data:", error);
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
				Gestión de Calificaciones (Sprints)
			</h1>

			<div className="space-y-8">
				<div className="flex justify-between items-center border-b pb-4">
					<h2 className="text-xl font-semibold text-gray-800">
						Sprints Pendientes de Evaluación
					</h2>
					<p className="text-sm text-gray-500">
						Mostrando solo sprints completados sin calificar.
					</p>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{pendingSprints.length === 0 ? (
						<div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
							<p className="text-gray-500">
								No hay sprints completados pendientes de revisión.
							</p>
						</div>
					) : (
						pendingSprints.map((sprint) => (
							<div
								key={sprint.id}
								className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow"
							>
								<div className="mb-4">
									<h3
										className="font-bold text-lg text-gray-800 truncate"
										title={sprint.name}
									>
										{sprint.name}
									</h3>
									<p className="text-sm text-gray-500 truncate">
										{sprint.project?.name || "Proyecto desconocido"}
									</p>
								</div>
								<div className="flex justify-between items-center mt-4">
									<span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded">
										{sprint.status}
									</span>
									<button
										type="button"
										onClick={() =>
											navigate(
												`/projects/${sprint.projectId}/sprints/${sprint.id}/grade`,
											)
										}
										className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
									>
										Ir a Calificar →
									</button>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
