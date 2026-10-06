import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { useCallback, useEffect, useState } from "react";
import { projectAPI, sprintAPI, taskAPI, userStoryAPI } from "@/api/client";
import { Modal } from "@/components/Modal";
import { useSession } from "@/hooks/useSession";

interface Task {
	id: string;
	title: string;
	description: string;
	status: string;
	deadline: string;
	createdAt: string;
	project: {
		id: string;
		name: string;
	};
}

interface Project {
	id: string;
	name: string;
}

interface Sprint {
	id: string;
	name: string;
	projectId: string;
}

interface UserStory {
	id: string;
	title: string;
	projectId: string;
}

const COLUMNS = {
	TODO: "Pendiente",
	IN_PROGRESS: "En Progreso",
	COMPLETED: "Completado",
};

export default function Tasks() {
	const { session: user } = useSession();
	const [tasks, setTasks] = useState<Task[]>([]);
	const [projects, setProjects] = useState<Project[]>([]);
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [userStories, setUserStories] = useState<UserStory[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		deadline: "",
		projectId: "",
		sprintId: "",
		userStoryId: "",
	});

	const loadTasks = useCallback(async (userId?: string) => {
		try {
			setIsLoading(true);
			const response = await taskAPI.getAll({ assigneeId: userId });
			setTasks((response as Task[]) || []);
		} catch (err) {
			setError("Error al cargar las tareas");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const loadProjects = useCallback(async (userId?: string) => {
		try {
			const projectsData = await projectAPI.getAll({ memberId: userId });
			setProjects(Array.isArray(projectsData) ? projectsData : []);
		} catch (err) {
			console.error("Error al cargar proyectos para el selector:", err);
		}
	}, []);

	const loadRelatedData = useCallback(async () => {
		try {
			const [sprintsData, storiesData] = await Promise.all([
				sprintAPI.getAll(),
				userStoryAPI.getAll(),
			]);
			// eslint-disable-next-line
			const sprintsList = Array.isArray(sprintsData)
				? sprintsData
				: (sprintsData as { data: Sprint[] }).data || [];
			setSprints(sprintsList);

			// eslint-disable-next-line
			const storiesList = Array.isArray(storiesData)
				? storiesData
				: (storiesData as { data: UserStory[] }).data || [];
			setUserStories(storiesList);
		} catch (err) {
			console.error("Error al cargar sprints y HUs:", err);
		}
	}, []);

	useEffect(() => {
		if (user) {
			loadTasks(user.id);
			loadProjects(user.id);
			loadRelatedData();
		}
	}, [user, loadTasks, loadProjects, loadRelatedData]);

	const handleCreateTask = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (!user) throw new Error("Usuario no autenticado");
			await taskAPI.create({
				...formData,
				assigneeId: user.id,
				status: "TODO",
			});
			setFormData({
				title: "",
				description: "",
				deadline: "",
				projectId: "",
				sprintId: "",
				userStoryId: "",
			});
			setShowModal(false);
			await loadTasks(user.id);
		} catch (err) {
			setError("Error al crear la tarea");
			console.error(err);
		}
	};

	const handleDeleteTask = async (id: string) => {
		if (!confirm("¿Estás seguro de que quieres eliminar esta tarea?")) return;
		try {
			const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
			if (!response.ok) throw new Error("Error al eliminar tarea");
			if (user) await loadTasks(user.id);
		} catch (err) {
			setError("Error al eliminar la tarea");
			console.error(err);
		}
	};

	const onDragEnd = async (result: DropResult) => {
		const { destination, source, draggableId } = result;

		if (!destination) return;

		if (
			destination.droppableId === source.droppableId &&
			destination.index === source.index
		) {
			return;
		}

		const newStatus = destination.droppableId;

		// Optimistic update
		const updatedTasks = tasks.map((task) =>
			task.id === draggableId ? { ...task, status: newStatus } : task,
		);
		setTasks(updatedTasks);

		try {
			await taskAPI.update(draggableId, { status: newStatus });
		} catch (err) {
			console.error("Error updating task status:", err);
			setError("Error al actualizar el estado de la tarea");
			// Revert on error
			if (user) loadTasks(user.id);
		}
	};

	const getTasksByStatus = (status: string) => {
		return tasks.filter((task) => (task.status || "TODO") === status);
	};

	const filteredSprints = sprints.filter(
		(s) => s.projectId === formData.projectId,
	);
	const filteredStories = userStories.filter(
		(s) => s.projectId === formData.projectId,
	);

	return (
		<div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h2 className="text-3xl font-bold text-gray-900">Mis Tareas</h2>
					<p className="text-gray-600 mt-2">
						Tablero Kanban de tus tareas asignadas
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowModal(true)}
					className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
				>
					+ Nueva Tarea
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
					<p className="text-gray-600 mt-4">Cargando tareas...</p>
				</div>
			)}

			{/* Kanban Board */}
			{!isLoading && (
				<DragDropContext onDragEnd={onDragEnd}>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
						{Object.entries(COLUMNS).map(([statusKey, statusLabel]) => (
							<div
								key={statusKey}
								className="bg-gray-100 rounded-lg p-4 flex flex-col h-full min-h-[500px]"
							>
								<h3 className="font-bold text-gray-700 mb-4 flex justify-between items-center">
									{statusLabel}
									<span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs">
										{getTasksByStatus(statusKey).length}
									</span>
								</h3>
								<Droppable droppableId={statusKey}>
									{(provided) => (
										<div
											{...provided.droppableProps}
											ref={provided.innerRef}
											className="flex-1 space-y-3"
										>
											{getTasksByStatus(statusKey).map((task, index) => (
												<Draggable
													key={task.id}
													draggableId={task.id}
													index={index}
												>
													{(provided) => (
														<div
															ref={provided.innerRef}
															{...provided.draggableProps}
															{...provided.dragHandleProps}
															className="bg-white p-4 rounded shadow-sm hover:shadow-md transition-shadow"
														>
															<div className="flex justify-between items-start mb-2">
																<h4 className="font-semibold text-gray-800">
																	{task.title}
																</h4>
																<button
																	type="button"
																	onClick={() => handleDeleteTask(task.id)}
																	className="text-red-400 hover:text-red-600"
																	title="Eliminar"
																>
																	×
																</button>
															</div>
															<p className="text-sm text-gray-600 mb-3 line-clamp-2">
																{task.description}
															</p>
															<div className="flex justify-between items-center text-xs text-gray-500">
																<span className="bg-blue-50 text-blue-900 px-2 py-1 rounded">
																	{task.project?.name}
																</span>
																{task.deadline && (
																	<span>
																		{new Date(
																			task.deadline,
																		).toLocaleDateString()}
																	</span>
																)}
															</div>
														</div>
													)}
												</Draggable>
											))}
											{provided.placeholder}
										</div>
									)}
								</Droppable>
							</div>
						))}
					</div>
				</DragDropContext>
			)}

			{/* Modal */}
			<Modal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title="Crear Nueva Tarea"
			>
				<form onSubmit={handleCreateTask}>
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
							value={formData.title}
							onChange={(e) =>
								setFormData({ ...formData, title: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							placeholder="Título de la tarea"
							required
						/>
					</div>
					<div className="mb-4">
						<label
							htmlFor="task-project"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Proyecto
						</label>
						<select
							id="task-project"
							value={formData.projectId}
							onChange={(e) =>
								setFormData({
									...formData,
									projectId: e.target.value,
									sprintId: "",
									userStoryId: "",
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							required
						>
							<option value="">Selecciona un proyecto</option>
							{projects.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</div>

					{formData.projectId && (
						<>
							<div className="mb-4">
								<label
									htmlFor="task-sprint"
									className="block text-sm font-medium text-gray-700 mb-2"
								>
									Sprint (Opcional)
								</label>
								<select
									id="task-sprint"
									value={formData.sprintId}
									onChange={(e) =>
										setFormData({ ...formData, sprintId: e.target.value })
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
								>
									<option value="">Sin Asignar</option>
									{filteredSprints.map((s) => (
										<option key={s.id} value={s.id}>
											{s.name}
										</option>
									))}
								</select>
							</div>

							<div className="mb-4">
								<label
									htmlFor="task-story"
									className="block text-sm font-medium text-gray-700 mb-2"
								>
									Historia de Usuario (Opcional)
								</label>
								<select
									id="task-story"
									value={formData.userStoryId}
									onChange={(e) =>
										setFormData({ ...formData, userStoryId: e.target.value })
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
								>
									<option value="">Sin Asignar</option>
									{filteredStories.map((s) => (
										<option key={s.id} value={s.id}>
											{s.title}
										</option>
									))}
								</select>
							</div>
						</>
					)}

					<div className="mb-4">
						<label
							htmlFor="task-desc"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Descripción
						</label>
						<textarea
							id="task-desc"
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							placeholder="Descripción de la tarea"
							rows={4}
						/>
					</div>
					<div className="mb-6">
						<label
							htmlFor="task-deadline"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Vencimiento
						</label>
						<input
							id="task-deadline"
							type="date"
							value={formData.deadline}
							onChange={(e) =>
								setFormData({ ...formData, deadline: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
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
