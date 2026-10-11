import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { projectAPI, sprintAPI } from "@/api/client";
import { Modal } from "@/components/Modal";
import { useSession } from "@/hooks/useSession";
import { formatDaysRemaining, getDaysDifference } from "@/utils/date";

interface Sprint {
	id: string;
	projectId: string;
	name: string;
	description: string;
	startDate: string;
	endDate: string;
	status: string;
	createdAt: string;
}

interface Project {
	id: string;
	name: string;
	members: { userId: string; role: string }[];
}

function canManageSprints(
	session: { id: string; role: string } | null,
	projects: Project[],
	sprint: Sprint,
): boolean {
	if (!session) return false;
	if (session.role === "ADMIN") return true;
	const project = projects.find((p) => p.id === sprint.projectId);
	const membership = project?.members?.find((m) => m.userId === session.id);
	return (
		membership?.role === "PRODUCT_OWNER" || membership?.role === "SCRUM_MASTER"
	);
}

export default function Sprints() {
	const navigate = useNavigate();
	const { projectId } = useParams<{ projectId: string }>();
	const { session: user } = useSession();
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [project, setProject] = useState<Project | null>(null);
	const [projectNotFound, setProjectNotFound] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		description: "",
		startDate: "",
		endDate: "",
	});

	const loadSprints = useCallback(async () => {
		if (!projectId) {
			setSprints([]);
			setIsLoading(false);
			return;
		}
		try {
			setIsLoading(true);
			setError(null);
			const sprintsData = (await sprintAPI.getAll({
				projectId,
			})) as Sprint[];
			// Respaldo en cliente: nunca mostrar sprints de otro proyecto.
			setSprints((sprintsData || []).filter((s) => s.projectId === projectId));
		} catch (err) {
			setError("Error al cargar los sprints");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		const fetchData = async () => {
			if (!projectId) {
				setProjectNotFound(true);
				return;
			}
			// Cargar el proyecto para mostrar su nombre y detectar un id inexistente.
			try {
				const projectData = (await projectAPI.getById(projectId)) as Project;
				setProject(projectData);
			} catch (err) {
				console.error("Error al cargar el proyecto:", err);
				setProjectNotFound(true);
			}

			await loadSprints();
		};

		fetchData();
	}, [projectId, loadSprints]);

	const handleCreateSprint = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (!user) {
				throw new Error("Usuario no autenticado");
			}

			if (!projectId) {
				throw new Error("Proyecto no encontrado");
			}

			const sprintData = {
				name: formData.name,
				description: formData.description,
				startDate: formData.startDate,
				endDate: formData.endDate,
				projectId,
			};

			await sprintAPI.create(sprintData);
			setFormData({
				name: "",
				description: "",
				startDate: "",
				endDate: "",
			});
			setShowModal(false);
			await loadSprints();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al crear el sprint");
			console.error(err);
		}
	};

	const handleDeleteSprint = async (id: string) => {
		if (!confirm("¿Estás seguro de que quieres eliminar este sprint?")) return;
		try {
			const response = await fetch(`/api/sprints/${id}`, { method: "DELETE" });
			if (!response.ok) {
				if (response.status === 403) {
					throw new Error("No tienes permiso para eliminar este sprint");
				}
				let message = "Error al eliminar el sprint";
				try {
					const body = (await response.json()) as { error?: string };
					if (body?.error) message = body.error;
				} catch {
					// Respuesta sin cuerpo JSON: se mantiene el mensaje genérico
				}
				throw new Error(message);
			}
			await loadSprints();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Error al eliminar el sprint",
			);
			console.error(err);
		}
	};

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			PLANNED: "bg-gray-100 text-gray-700",
			ACTIVE: "bg-blue-100 text-blue-900",
			COMPLETED: "bg-green-100 text-green-700",
		};
		return colors[status] || "bg-gray-100 text-gray-700";
	};

	if (projectNotFound) {
		return (
			<div className="p-8 max-w-7xl mx-auto text-center py-16">
				<div className="text-5xl mb-4">🔍</div>
				<h3 className="text-xl font-semibold text-gray-900 mb-2">
					Proyecto no encontrado
				</h3>
				<p className="text-gray-600 mb-6">
					El proyecto que buscas no existe o fue eliminado.
				</p>
				<button
					type="button"
					onClick={() => navigate("/projects")}
					className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
				>
					Ir a proyectos
				</button>
			</div>
		);
	}

	return (
		<div className="p-8 max-w-7xl mx-auto">
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h2 className="text-3xl font-bold text-gray-900">Sprints</h2>
					<p className="text-gray-600 mt-2">
						Proyecto:{" "}
						<span className="font-medium text-gray-900">
							{project?.name ?? "…"}
						</span>
						{projectId && (
							<>
								{" · "}
								<Link
									to={`/projects/${projectId}`}
									className="text-blue-900 hover:underline"
								>
									Ir al proyecto
								</Link>
							</>
						)}
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowModal(true)}
					className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
				>
					+ Nuevo Sprint
				</button>
			</div>

			{/* Error Message */}
			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
					{error}
				</div>
			)}

			{/* Loading */}
			{isLoading && (
				<div className="text-center py-12">
					<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-950" />
					<p className="text-gray-600 mt-4">Cargando sprints...</p>
				</div>
			)}

			{/* Sprints Grid */}
			{!isLoading && sprints.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{sprints.map((sprint) => (
						<div
							key={sprint.id}
							className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
						>
							<div className="flex items-start justify-between mb-4">
								<div>
									<h3 className="text-lg font-semibold text-gray-900">
										{sprint.name}
									</h3>
									<p className="text-sm text-gray-500 mt-1">
										{new Date(sprint.startDate).toLocaleDateString()} -{" "}
										{new Date(sprint.endDate).toLocaleDateString()}
									</p>
								</div>
								<span
									className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(sprint.status)}`}
								>
									{sprint.status || "PLANNED"}
								</span>
							</div>
							<p className="text-gray-600 mb-4">{sprint.description}</p>
							<div className="mb-4">
								<div className="flex items-center justify-between text-sm mb-2">
									<span className="text-gray-600">Vencimiento:</span>
									<span className="font-semibold text-blue-950">
										{formatDaysRemaining(sprint.endDate)}
									</span>
								</div>
								<div className="w-full bg-gray-200 rounded-full h-2">
									<div
										className="bg-blue-950 h-2 rounded-full"
										style={{
											width: `${Math.max(0, Math.min(100, ((14 - getDaysDifference(sprint.endDate)) / 14) * 100))}%`,
										}}
									/>
								</div>
							</div>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() =>
										navigate(
											`/projects/${sprint.projectId}/sprints/${sprint.id}`,
										)
									}
									className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 font-medium text-sm"
								>
									Ver Detalles
								</button>
								{canManageSprints(user, project ? [project] : [], sprint) && (
									<button
										type="button"
										onClick={() => handleDeleteSprint(sprint.id)}
										className="flex-1 bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200 font-medium text-sm"
									>
										Eliminar
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Empty State */}
			{!isLoading && sprints.length === 0 && (
				<div className="text-center py-16">
					<div className="text-5xl mb-4">🏃</div>
					<h3 className="text-xl font-semibold text-gray-900 mb-2">
						No hay sprints
					</h3>
					<p className="text-gray-600 mb-6">
						Crea tu primer sprint para comenzar el desarrollo
					</p>
					<button
						type="button"
						onClick={() => setShowModal(true)}
						className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
					>
						Crear Sprint
					</button>
				</div>
			)}

			{/* Modal */}
			<Modal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title="Crear Nuevo Sprint"
			>
				<form onSubmit={handleCreateSprint}>
					<div className="mb-4">
						<span className="block text-sm font-medium text-gray-700 mb-2">
							Proyecto
						</span>
						<p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
							{project?.name ?? "…"}
						</p>
					</div>
					<div className="mb-4">
						<label
							htmlFor="sprint-name"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Nombre
						</label>
						<input
							id="sprint-name"
							type="text"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							placeholder="Sprint 1"
							required
						/>
					</div>
					<div className="mb-4">
						<label
							htmlFor="sprint-desc"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Descripción
						</label>
						<textarea
							id="sprint-desc"
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							placeholder="Descripción del sprint"
							rows={3}
						/>
					</div>
					<div className="mb-4">
						<label
							htmlFor="sprint-start"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Fecha de inicio
						</label>
						<input
							id="sprint-start"
							type="date"
							value={formData.startDate}
							onChange={(e) =>
								setFormData({ ...formData, startDate: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							required
						/>
					</div>
					<div className="mb-6">
						<label
							htmlFor="sprint-end"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Fecha de fin
						</label>
						<input
							id="sprint-end"
							type="date"
							value={formData.endDate}
							onChange={(e) =>
								setFormData({ ...formData, endDate: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							required
						/>
					</div>
					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => setShowModal(false)}
							className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
						>
							Cancelar
						</button>
						<button
							type="submit"
							className="flex-1 px-4 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-900 font-medium"
						>
							Crear
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
