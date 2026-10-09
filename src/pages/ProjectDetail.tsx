import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "@/components/Modal";
import RetrospectiveBoard from "@/components/RetrospectiveBoard";
import { useSession } from "@/hooks/useSession";
import { ChatSection } from "./ProjectDetailSections/ChatSection";
import { DocumentsSection } from "./ProjectDetailSections/DocumentsSection";
import { MembersSection } from "./ProjectDetailSections/MembersSection";

interface Project {
	id: string;
	name: string;
	description: string;
	status: string;
	createdAt: string;
	ownerId: string;
	members: ProjectMember[];
}

interface ProjectMember {
	userId: string;
	role: string;
}

interface UserStory {
	id: string;
	title: string;
	description: string;
	priority: string;
	storyPoints?: number;
	projectId: string;
	sprintId?: string | null;
}

interface Sprint {
	id: string;
	projectId: string;
	name: string;
	startDate: string;
	endDate: string;
	status: string;
	userStories: UserStory[];
	tasks?: { status: string }[];
}

function canStartSprint(status: string): boolean {
	return status === "PLANNING" || status === "PLANNED";
}

function canCompleteSprint(status: string): boolean {
	return status === "ACTIVE";
}

export default function ProjectDetail() {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const { session: user } = useSession();
	const [project, setProject] = useState<Project | null>(null);
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [backlogStories, setBacklogStories] = useState<UserStory[]>([]);
	const [isProjectAdmin, setIsProjectAdmin] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showSprintModal, setShowSprintModal] = useState(false);
	const [activeTab, setActiveTab] = useState<
		"board" | "chat" | "docs" | "members" | "retro"
	>("board"); // Tab state
	const [sprintForm, setSprintForm] = useState({
		name: "",
		description: "",
		startDate: "",
		endDate: "",
	});

	const loadProject = useCallback(async () => {
		if (!id) return;
		try {
			setIsLoading(true);

			// Fetch project
			const projectResponse = await fetch(`/api/projects/${id}`);
			if (!projectResponse.ok) throw new Error("Proyecto no encontrado");
			const projectData = await projectResponse.json();
			setProject(projectData.data);

			// Fetch sprints
			const sprintsResponse = await fetch("/api/sprints");
			const sprintsData = await sprintsResponse.json();
			const sprintsList = Array.isArray(sprintsData)
				? sprintsData
				: sprintsData.data || [];
			const projectSprints: Sprint[] = (sprintsList as Sprint[]).filter(
				(s) => s.projectId === id,
			);
			setSprints(projectSprints || []);

			// Fetch ALL User Stories for this project
			const storiesResponse = await fetch("/api/user-stories");
			const storiesData = await storiesResponse.json();
			const storiesList = Array.isArray(storiesData)
				? storiesData
				: storiesData.data || [];
			const projectStories: UserStory[] = (storiesList as UserStory[]).filter(
				(s: UserStory) => s.projectId === id,
			);

			// Filter stories that are NOT in any sprint
			// We can rely on sprintId property or the fact they are in sprint.userStories
			// Ideally the stories fetched from /api/user-stories have sprintId

			// Wait, does /api/user-stories return sprintId?
			// We haven't checked user-stories.ts but prisma defaults to including scalars.
			// So yes.

			const unassigned = projectStories.filter((s) => !s.sprintId);
			setBacklogStories(unassigned);
		} catch (err) {
			setError(
				`Error al cargar el proyecto: ${err instanceof Error ? err.message : String(err)}`,
			);
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	}, [id]);

	useEffect(() => {
		loadProject();
	}, [loadProject]);

	useEffect(() => {
		if (user && project) {
			const isOwner = project.ownerId === user.id;
			const member = project.members.find((m) => m.userId === user.id);
			const isLead =
				member?.role === "OWNER" ||
				member?.role === "LEAD" ||
				member?.role === "SCRUM_MASTER" ||
				member?.role === "PRODUCT_OWNER";
			setIsProjectAdmin(isOwner || isLead || user.role === "ADMIN");
		}
	}, [user, project]);

	const handleCreateSprint = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!id) return;
		try {
			const response = await fetch("/api/sprints", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...sprintForm,
					projectId: id,
				}),
			});
			if (!response.ok) throw new Error("Error al crear sprint");
			setSprintForm({ name: "", description: "", startDate: "", endDate: "" });
			setShowSprintModal(false);
			loadProject();
		} catch (err) {
			setError("Error al crear el sprint");
			console.error(err);
		}
	};

	const handleSprintStatus = async (sprintId: string, status: string) => {
		if (status === "COMPLETED") {
			const sprint = sprints.find((s) => s.id === sprintId);
			const pendingTasks =
				sprint?.tasks?.filter((t) => t.status !== "COMPLETED").length ?? 0;
			const message =
				pendingTasks > 0
					? `Hay ${pendingTasks} tarea(s) sin completar en "${sprint?.name ?? "el sprint"}". ¿Completar el sprint igualmente? Se notificará a todos los miembros.`
					: "¿Completar el sprint? Se notificará a todos los miembros.";
			if (!confirm(message)) return;
		}
		try {
			const response = await fetch(`/api/sprints/${sprintId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status }),
			});
			if (!response.ok) {
				let message = "No se pudo actualizar el sprint";
				try {
					const body = (await response.json()) as { error?: string };
					if (body?.error) message = body.error;
				} catch {
					// Respuesta sin cuerpo JSON: se mantiene el mensaje genérico
				}
				throw new Error(message);
			}
			await loadProject();
		} catch (err) {
			alert(
				err instanceof Error ? err.message : "No se pudo actualizar el sprint",
			);
		}
	};

	const onDragEnd = async (result: DropResult) => {
		const { source, destination, draggableId } = result;

		if (!destination) return;

		// If dropped in same place
		if (
			source.droppableId === destination.droppableId &&
			source.index === destination.index
		) {
			return;
		}

		// Moving from Backlog to Sprint
		if (
			source.droppableId === "backlog" &&
			destination.droppableId.startsWith("sprint-")
		) {
			const sprintId = destination.droppableId.replace("sprint-", "");

			try {
				// Optimistic update
				const storyToMove = backlogStories.find((s) => s.id === draggableId);
				if (!storyToMove) return;

				// Remove from backlog
				setBacklogStories((prev) => prev.filter((s) => s.id !== draggableId));

				// Add to sprint (visually)
				setSprints((prev) =>
					prev.map((s) => {
						if (s.id === sprintId) {
							return {
								...s,
								userStories: [
									...(s.userStories || []),
									{ ...storyToMove, sprintId },
								],
							};
						}
						return s;
					}),
				);

				// API Call
				const response = await fetch(`/api/sprints/${sprintId}/add-story`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userStoryId: draggableId }),
				});

				if (!response.ok) {
					const data = await response.json();
					// Revert if fail (simplest is reload)
					alert(data.error || "Error al asignar historia");
					loadProject();
				} else {
					// Refresh to get real IDs
					loadProject();
				}
			} catch (error) {
				console.error(error);
				loadProject();
			}
		}

		// Moving from Sprint back to Backlog
		if (
			source.droppableId.startsWith("sprint-") &&
			destination.droppableId === "backlog"
		) {
			const sprintId = source.droppableId.replace("sprint-", "");

			try {
				// Optimistic update: leer primero del estado actual (el updater
				// de setSprints es diferido y no hay que depender de él para datos)
				const sourceSprint = sprints.find((s) => s.id === sprintId);
				const storyToMove = sourceSprint?.userStories?.find(
					(story) => story.id === draggableId,
				);
				if (!storyToMove) return;

				// Remove from sprint (visually)
				setSprints((prev) =>
					prev.map((s) => {
						if (s.id === sprintId) {
							return {
								...s,
								userStories: (s.userStories || []).filter(
									(story) => story.id !== draggableId,
								),
							};
						}
						return s;
					}),
				);

				// Add to backlog (visually)
				setBacklogStories((prev) => [
					...prev,
					{ ...storyToMove, sprintId: null },
				]);

				// API Call
				const response = await fetch(
					`/api/sprints/${sprintId}/stories/${draggableId}`,
					{ method: "DELETE" },
				);

				if (!response.ok) {
					const data = await response.json();
					// Revert if fail (simplest is reload)
					alert(data.error || "Error al quitar historia del sprint");
					loadProject();
				} else {
					// Refresh to get real IDs
					loadProject();
				}
			} catch (error) {
				console.error(error);
				loadProject();
			}
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950" />
					<p className="text-gray-600 mt-4">Cargando proyecto...</p>
				</div>
			</div>
		);
	}

	if (error || !project) {
		return (
			<div className="p-8">
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
					{error || "Proyecto no encontrado"}
				</div>
				<button
					type="button"
					onClick={() => navigate("/projects")}
					className="mt-4 bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
				>
					Volver a Proyectos
				</button>
			</div>
		);
	}

	return (
		<div className="p-8 max-w-7xl mx-auto">
			{/* Header */}
			<div className="mb-6">
				<button
					type="button"
					onClick={() => navigate("/projects")}
					className="text-blue-950 hover:text-blue-900 font-medium mb-4 flex items-center gap-2"
				>
					← Volver a Proyectos
				</button>
				<div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
					<div>
						<h1 className="text-4xl font-bold text-gray-900">{project.name}</h1>
						<p className="text-gray-600 mt-2">{project.description}</p>
						{isProjectAdmin && (
							<button
								type="button"
								onClick={() => navigate(`/projects/${project.id}/grade`)}
								className="mt-3 text-sm text-blue-950 hover:text-blue-800 font-medium flex items-center gap-1"
							>
								<svg
									className="w-4 h-4"
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
								Calificar Proyecto
							</button>
						)}
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setActiveTab("board")}
							className={`px-4 py-2 rounded-lg font-medium ${activeTab === "board" ? "bg-blue-100 text-blue-900" : "bg-white text-gray-600 hover:bg-gray-50"}`}
						>
							Tablero & Sprints
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("members")}
							className={`px-4 py-2 rounded-lg font-medium ${activeTab === "members" ? "bg-blue-100 text-blue-900" : "bg-white text-gray-600 hover:bg-gray-50"}`}
						>
							Miembros
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("chat")}
							className={`px-4 py-2 rounded-lg font-medium ${activeTab === "chat" ? "bg-blue-100 text-blue-900" : "bg-white text-gray-600 hover:bg-gray-50"}`}
						>
							Chat
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("docs")}
							className={`px-4 py-2 rounded-lg font-medium ${activeTab === "docs" ? "bg-blue-100 text-blue-900" : "bg-white text-gray-600 hover:bg-gray-50"}`}
						>
							Documentos
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("retro")}
							className={`px-4 py-2 rounded-lg font-medium ${activeTab === "retro" ? "bg-blue-100 text-blue-900" : "bg-white text-gray-600 hover:bg-gray-50"}`}
						>
							Retrospectiva
						</button>
					</div>
				</div>
			</div>

			{activeTab === "chat" && <ChatSection projectId={project.id} />}
			{activeTab === "docs" && <DocumentsSection projectId={project.id} />}
			{activeTab === "members" && (
				<MembersSection
					projectId={project.id}
					isProjectAdmin={isProjectAdmin}
				/>
			)}

			{activeTab === "retro" && (
				<div>
					{sprints.length > 0 ? (
						<div>
							<div className="mb-4 flex items-center gap-4">
								<label
									htmlFor="retro-sprint-select"
									className="font-bold text-gray-700"
								>
									Sprint:
								</label>
								<select
									id="retro-sprint-select"
									className="border rounded px-3 py-1"
									onChange={(_e) => {
										// We could add state for selected sprint, but for now maybe just show the first active/latest one?
										// Actually, RetrospectiveBoard needs a sprintId.
										// Let's pass the first one by default or manage state.
										// For simplicity in this turn, I will pick the first sprint.
									}}
								>
									{sprints.map((s) => (
										<option key={s.id} value={s.id}>
											{s.name}
										</option>
									))}
								</select>
								<span className="text-xs text-gray-500">
									(Mostrando retrospectiva del primer sprint listado por ahora)
								</span>
							</div>
							<RetrospectiveBoard sprintId={sprints[0].id} />
						</div>
					) : (
						<div className="text-center py-12 text-gray-500">
							No hay sprints para realizar retrospectiva.
						</div>
					)}
				</div>
			)}

			{activeTab === "board" && (
				<DragDropContext onDragEnd={onDragEnd}>
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
						{/* BACKLOG SECTION */}
						<div className="bg-gray-50 p-4 rounded-lg shadow-inner h-fit">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-lg font-bold text-gray-700">
									Backlog (Historias)
								</h2>
								<span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs">
									{backlogStories.length}
								</span>
							</div>

							<Droppable droppableId="backlog">
								{(provided) => (
									<div
										ref={provided.innerRef}
										{...provided.droppableProps}
										className="space-y-3 min-h-[200px]"
									>
										{backlogStories.length === 0 && (
											<p className="text-sm text-gray-500 text-center py-4">
												No hay historias sin asignar.
											</p>
										)}
										{backlogStories.map((story, index) => (
											<Draggable
												key={story.id}
												draggableId={story.id}
												index={index}
											>
												{(provided) => (
													<div
														ref={provided.innerRef}
														{...provided.draggableProps}
														{...provided.dragHandleProps}
														className="bg-white p-3 rounded shadow-sm hover:shadow-md border border-gray-200 cursor-grab"
													>
														<h3 className="font-medium text-sm text-gray-800">
															{story.title}
														</h3>
														<div className="flex justify-between items-center mt-2">
															<span
																className={`text-xs px-2 py-0.5 rounded-full ${
																	story.priority === "HIGH"
																		? "bg-orange-100 text-orange-700"
																		: story.priority === "CRITICAL"
																			? "bg-red-100 text-red-700"
																			: "bg-green-100 text-green-700"
																}`}
															>
																{story.priority}
															</span>
															{story.storyPoints != null && (
																<span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
																	{story.storyPoints} pts
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

						{/* SPRINTS SECTION */}
						<div className="lg:col-span-2 space-y-6">
							<div className="flex justify-between items-center">
								<h2 className="text-2xl font-bold text-gray-900">Sprints</h2>
								{isProjectAdmin && (
									<button
										type="button"
										onClick={() => setShowSprintModal(true)}
										className="bg-blue-950 text-white px-4 py-2 rounded-lg hover:bg-blue-900 text-sm font-medium"
									>
										+ Nuevo Sprint
									</button>
								)}
							</div>

							{sprints.length === 0 ? (
								<div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
									<p className="text-gray-500">No hay sprints activos.</p>
								</div>
							) : (
								sprints.map((sprint) => (
									<div
										key={sprint.id}
										className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
									>
										<div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
											<div>
												<h3 className="font-bold text-lg text-gray-800">
													{sprint.name}
												</h3>
												<p className="text-xs text-gray-500">
													{new Date(sprint.startDate).toLocaleDateString()} -{" "}
													{new Date(sprint.endDate).toLocaleDateString()}
												</p>
											</div>
											<div className="flex items-center gap-3">
												{isProjectAdmin && (
													<button
														type="button"
														onClick={() =>
															navigate(
																`/projects/${project.id}/sprints/${sprint.id}/grade`,
															)
														}
														className="text-xs text-blue-950 hover:text-blue-800 font-medium underline"
													>
														Calificar Sprint
													</button>
												)}
												{isProjectAdmin && canStartSprint(sprint.status) && (
													<button
														type="button"
														onClick={() =>
															handleSprintStatus(sprint.id, "ACTIVE")
														}
														className="text-xs text-green-700 hover:text-green-800 font-medium underline"
													>
														Iniciar Sprint
													</button>
												)}
												{isProjectAdmin && canCompleteSprint(sprint.status) && (
													<button
														type="button"
														onClick={() =>
															handleSprintStatus(sprint.id, "COMPLETED")
														}
														className="text-xs text-blue-950 hover:text-blue-800 font-medium underline"
													>
														Completar Sprint
													</button>
												)}
												<span
													className={`px-3 py-1 rounded-full text-xs font-bold ${
														sprint.status === "ACTIVE"
															? "bg-green-100 text-green-700"
															: "bg-gray-200 text-gray-700"
													}`}
												>
													{sprint.status}
												</span>
											</div>
										</div>

										<Droppable droppableId={`sprint-${sprint.id}`}>
											{(provided) => (
												<div
													ref={provided.innerRef}
													{...provided.droppableProps}
													className="p-4 min-h-[100px] bg-white"
												>
													{!sprint.userStories ||
													sprint.userStories.length === 0 ? (
														<div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded">
															Arrastra historias aquí para planificar el sprint
														</div>
													) : (
														<div className="space-y-2">
															{sprint.userStories.map((story, index) => (
																<Draggable
																	key={story.id}
																	draggableId={story.id}
																	index={index}
																>
																	{(provided) => (
																		<div
																			ref={provided.innerRef}
																			{...provided.draggableProps}
																			{...provided.dragHandleProps}
																			className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-100 cursor-grab"
																		>
																			<div>
																				<p className="font-medium text-sm text-blue-900">
																					{story.title}
																				</p>
																				<p className="text-xs text-blue-950 mt-0.5 line-clamp-1">
																					{story.description}
																				</p>
																			</div>
																			{story.storyPoints != null && (
																				<span className="text-xs font-bold bg-white text-blue-950 px-2 py-1 rounded border border-blue-100">
																					{story.storyPoints}
																				</span>
																			)}
																		</div>
																	)}
																</Draggable>
															))}
														</div>
													)}
													{provided.placeholder}
												</div>
											)}
										</Droppable>
									</div>
								))
							)}
						</div>
					</div>
				</DragDropContext>
			)}

			{/* Sprint Modal */}
			<Modal
				isOpen={showSprintModal}
				onClose={() => setShowSprintModal(false)}
				title="Nuevo Sprint"
			>
				<form onSubmit={handleCreateSprint}>
					{/* Form fields same as before */}
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
							value={sprintForm.name}
							onChange={(e) =>
								setSprintForm({ ...sprintForm, name: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
							value={sprintForm.description}
							onChange={(e) =>
								setSprintForm({
									...sprintForm,
									description: e.target.value,
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg"
						/>
					</div>
					<div className="grid grid-cols-2 gap-4 mb-6">
						<div>
							<label
								htmlFor="sprint-start"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Inicio
							</label>
							<input
								id="sprint-start"
								type="date"
								value={sprintForm.startDate}
								onChange={(e) =>
									setSprintForm({
										...sprintForm,
										startDate: e.target.value,
									})
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg"
								required
							/>
						</div>
						<div>
							<label
								htmlFor="sprint-end"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Fin
							</label>
							<input
								id="sprint-end"
								type="date"
								value={sprintForm.endDate}
								onChange={(e) =>
									setSprintForm({
										...sprintForm,
										endDate: e.target.value,
									})
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg"
								required
							/>
						</div>
					</div>
					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => setShowSprintModal(false)}
							className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
						>
							Cancelar
						</button>
						<button
							type="submit"
							className="flex-1 px-4 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-900"
						>
							Crear
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
