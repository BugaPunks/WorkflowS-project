import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { formatDaysRemaining, getDaysDifference } from "@/utils/date";

interface Sprint {
	id: string;
	name: string;
	description: string;
	startDate: string;
	endDate: string;
	status: string;
	projectId: string;
}

interface Task {
	id: string;
	title: string;
	status: string;
	deadline: string;
}

const COLUMNS = {
	TODO: "Pendiente",
	IN_PROGRESS: "En Progreso",
	COMPLETED: "Completado",
};

export default function SprintDetail() {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const { session: user } = useSession();
	const [sprint, setSprint] = useState<Sprint | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadSprint = useCallback(async () => {
		if (!id) return;
		try {
			setIsLoading(true);
			const response = await fetch(`/api/sprints/${id}`);
			if (!response.ok) throw new Error("Sprint no encontrado");
			const data = await response.json();
			setSprint(data.data);
			setTasks(data.data.tasks || []);
		} catch (err) {
			setError("Error al cargar el sprint");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	}, [id]);

	useEffect(() => {
		if (user === null) {
			// Wait for session to load
			return;
		}
		if (!user) {
			navigate("/login");
			return;
		}
		loadSprint();
	}, [navigate, loadSprint, user]);

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
			await fetch(`/api/tasks/${draggableId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: newStatus }),
			});
		} catch (err) {
			console.error("Error updating task status:", err);
			setError("Error al actualizar el estado de la tarea");
			loadSprint(); // Revert on error
		}
	};

	const getTasksByStatus = (status: string) => {
		return tasks.filter((task) => (task.status || "TODO") === status);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950" />
					<p className="text-gray-600 mt-4">Cargando sprint...</p>
				</div>
			</div>
		);
	}

	if (error || !sprint) {
		return (
			<div className="p-8">
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
					{error || "Sprint no encontrado"}
				</div>
				<button
					type="button"
					onClick={() => navigate("/sprints")}
					className="mt-4 bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
				>
					Volver a Sprints
				</button>
			</div>
		);
	}

	return (
		<div className="p-8 max-w-7xl mx-auto">
			{/* Header */}
			<div className="mb-8">
				<button
					type="button"
					onClick={() => navigate("/sprints")}
					className="text-blue-950 hover:text-blue-900 font-medium mb-4 flex items-center gap-2"
				>
					← Volver a Sprints
				</button>
				<h1 className="text-4xl font-bold text-gray-900">{sprint.name}</h1>
				<p className="text-gray-600 mt-2">{sprint.description}</p>

				{user?.role === "ADMIN" && (
					<button
						type="button"
						onClick={() =>
							navigate(
								`/projects/${sprint.projectId}/sprints/${sprint.id}/grade`,
							)
						}
						className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-900 rounded-lg font-medium hover:bg-blue-100 transition-colors"
					>
						<svg
							className="w-5 h-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<title>Icono Calificar</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Calificar Sprint
					</button>
				)}

				{/* Sprint Stats */}
				<div className="flex items-center gap-6 mt-6">
					<div>
						<span className="inline-block px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-900">
							{sprint.status}
						</span>
					</div>
					<div className="text-sm text-gray-600">
						<strong>Inicio:</strong>{" "}
						{new Date(sprint.startDate).toLocaleDateString()}
					</div>
					<div className="text-sm text-gray-600">
						<strong>Fin:</strong>{" "}
						{new Date(sprint.endDate).toLocaleDateString()}
					</div>
					<div className="text-sm font-semibold text-blue-950">
						Vencimiento: {formatDaysRemaining(sprint.endDate)}
					</div>
				</div>
			</div>

			{/* Progress Bar */}
			<div className="mb-8">
				<div className="flex items-center justify-between mb-2">
					<span className="text-sm font-medium text-gray-700">Progreso</span>
					<span className="text-sm text-gray-600">
						{Math.min(
							100,
							Math.max(
								0,
								((14 - getDaysDifference(sprint.endDate)) / 14) * 100,
							),
						).toFixed(0)}
						%
					</span>
				</div>
				<div className="w-full bg-gray-200 rounded-full h-3">
					<div
						className="bg-blue-950 h-3 rounded-full transition-all"
						style={{
							width: `${Math.min(
								100,
								Math.max(
									0,
									((14 - getDaysDifference(sprint.endDate)) / 14) * 100,
								),
							)}%`,
						}}
					/>
				</div>
			</div>

			{/* Tasks Section */}
			<div>
				<h2 className="text-2xl font-bold text-gray-900 mb-6">
					Tablero Kanban
				</h2>

				{tasks.length === 0 ? (
					<div className="bg-white rounded-lg shadow-md p-8 text-center">
						<div className="text-5xl mb-4">📝</div>
						<h3 className="text-xl font-semibold text-gray-900 mb-2">
							No hay tareas en este sprint
						</h3>
						<p className="text-gray-600">
							Las tareas asignadas aparecerán aquí
						</p>
					</div>
				) : (
					<DragDropContext onDragEnd={onDragEnd}>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
																className="bg-white p-4 rounded shadow-sm hover:shadow-md transition-shadow cursor-grab"
															>
																<div className="flex justify-between items-start mb-2">
																	<h4 className="font-semibold text-gray-800">
																		{task.title}
																	</h4>
																</div>
																{task.deadline && (
																	<div className="text-xs text-gray-500 mt-2">
																		📅{" "}
																		{new Date(
																			task.deadline,
																		).toLocaleDateString()}
																	</div>
																)}
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
			</div>
		</div>
	);
}
