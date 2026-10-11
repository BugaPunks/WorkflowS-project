import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { formatDaysRemaining } from "@/utils/date";

interface Task {
	id: string;
	title: string;
	description: string;
	status: string;
	deadline: string;
	createdAt: string;
	projectId: string;
	project?: {
		name: string;
	};
}

export default function TaskDetail() {
	const navigate = useNavigate();
	const { projectId, taskId } = useParams<{
		projectId: string;
		taskId: string;
	}>();
	const backToTasks = projectId ? `/projects/${projectId}/tasks` : "/projects";
	const [task, setTask] = useState<Task | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showEditModal, setShowEditModal] = useState(false);
	const [editForm, setEditForm] = useState({
		title: "",
		description: "",
		status: "",
	});

	const loadTask = useCallback(async () => {
		if (!taskId) return;
		try {
			setIsLoading(true);
			const response = await fetch(`/api/tasks/${taskId}`);
			if (!response.ok) throw new Error("Tarea no encontrada");
			const data = await response.json();
			setTask(data.data);
			setEditForm({
				title: data.data.title,
				description: data.data.description,
				status: data.data.status,
			});
		} catch (err) {
			setError("Error al cargar la tarea");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	}, [taskId]);

	useEffect(() => {
		loadTask();
	}, [loadTask]);

	const handleUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!taskId) return;
		try {
			const response = await fetch(`/api/tasks/${taskId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(editForm),
			});
			if (!response.ok) throw new Error("Error al actualizar");
			setShowEditModal(false);
			await loadTask();
		} catch (err) {
			setError("Error al actualizar la tarea");
			console.error(err);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950" />
					<p className="text-gray-600 mt-4">Cargando tarea...</p>
				</div>
			</div>
		);
	}

	if (error || !task) {
		return (
			<div className="p-8">
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
					{error || "Tarea no encontrada"}
				</div>
				<button
					type="button"
					onClick={() => navigate(backToTasks)}
					className="mt-4 bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
				>
					Volver a Tareas
				</button>
			</div>
		);
	}

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			PENDING: "bg-yellow-100 text-yellow-700",
			IN_PROGRESS: "bg-blue-100 text-blue-900",
			COMPLETED: "bg-green-100 text-green-700",
			CANCELLED: "bg-gray-100 text-gray-700",
		};
		return colors[status] || "bg-gray-100 text-gray-700";
	};

	const isOverdue =
		new Date(task.deadline) < new Date() && task.status !== "COMPLETED";

	return (
		<div className="p-8 max-w-4xl mx-auto">
			{/* Header */}
			<PageHeader
				breadcrumbs={[
					{ label: "Proyectos", to: "/projects" },
					{
						label: task.project?.name ?? "...",
						to: projectId ? `/projects/${projectId}` : undefined,
					},
					{ label: "Tareas", to: backToTasks },
					{ label: task.title },
				]}
				title={task.title}
				subtitle={task.description}
				actions={
					<>
						<button
							type="button"
							onClick={() =>
								navigate(`/projects/${task.projectId}/tasks/${task.id}/grade`)
							}
							className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium whitespace-nowrap"
						>
							Calificar
						</button>
						<button
							type="button"
							onClick={() => setShowEditModal(true)}
							className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium whitespace-nowrap"
						>
							Editar
						</button>
					</>
				}
			/>

			<div className="mb-8">
				{/* Task Details */}
				<div className="bg-white rounded-lg shadow-md p-8 mb-8">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						{/* Left Column */}
						<div className="space-y-6">
							<div>
								<h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
									Estado
								</h3>
								<span
									className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}
								>
									{task.status}
								</span>
							</div>

							<div>
								<h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
									Creado
								</h3>
								<p className="text-gray-600">
									{new Date(task.createdAt).toLocaleDateString()}
								</p>
							</div>
						</div>

						{/* Right Column */}
						<div className="space-y-6">
							<div>
								<h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
									Vencimiento
								</h3>
								<p
									className={`font-medium ${isOverdue ? "text-red-600" : "text-gray-900"}`}
								>
									{new Date(task.deadline).toLocaleDateString()}
								</p>
								{isOverdue && (
									<p className="text-red-600 text-sm mt-1">
										⚠️ Esta tarea está vencida
									</p>
								)}
							</div>

							<div>
								<h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
									Días para vencer
								</h3>
								<p className="text-gray-600">
									{formatDaysRemaining(task.deadline)}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Edit Modal */}
				<Modal
					isOpen={showEditModal}
					onClose={() => setShowEditModal(false)}
					title="Editar Tarea"
				>
					<form onSubmit={handleUpdate}>
						<div className="mb-4">
							<label
								htmlFor="task-title"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Título
							</label>
							<input
								id="task-title"
								type="text"
								value={editForm.title}
								onChange={(e) =>
									setEditForm({ ...editForm, title: e.target.value })
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
								required
							/>
						</div>
						<div className="mb-4">
							<label
								htmlFor="task-desc"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Descripción
							</label>
							<textarea
								id="task-desc"
								value={editForm.description}
								onChange={(e) =>
									setEditForm({ ...editForm, description: e.target.value })
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
								rows={4}
							/>
						</div>
						<div className="mb-6">
							<label
								htmlFor="task-status"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Estado
							</label>
							<select
								id="task-status"
								value={editForm.status}
								onChange={(e) =>
									setEditForm({ ...editForm, status: e.target.value })
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							>
								<option value="PENDING">Pendiente</option>
								<option value="IN_PROGRESS">En Progreso</option>
								<option value="COMPLETED">Completada</option>
								<option value="CANCELLED">Cancelada</option>
							</select>
						</div>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => setShowEditModal(false)}
								className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
							>
								Cancelar
							</button>
							<button
								type="submit"
								className="flex-1 px-4 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-900 font-medium"
							>
								Guardar
							</button>
						</div>
					</form>
				</Modal>
			</div>
		</div>
	);
}
