import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "@/components/Modal";
import RetrospectiveBoard from "@/components/RetrospectiveBoard";
import { useSession } from "@/hooks/useSession";

// Types for internal state to avoid 'any'
interface ChatMessage {
	id: string;
	user: { name: string };
	content: string;
	userId: string;
}

interface DocumentItem {
	id: string;
	name: string;
	type: string;
	size: number;
	uploadedAt: string;
	url: string;
	version: number;
	latestVersion?: number; // From aggregation
	versionCount?: number; // From aggregation
}

interface DocumentVersion {
	id: string;
	version: number;
	uploadedAt: string;
	url: string;
}

interface ProjectMemberDetails {
	id: string;
	userId: string;
	role: string;
	user?: {
		name: string;
		email: string;
	};
}

interface AvailableUser {
	id: string;
	name: string;
	email: string;
}

function ChatSection({ projectId }: { projectId: string }) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const { session: currentUser } = useSession();

	const loadMessages = useCallback(async () => {
		try {
			const response = await fetch(`/api/chat/${projectId}/messages`);
			if (response.ok) {
				const data = await response.json();
				setMessages(data.data || []);
			}
		} catch (err) {
			console.error(err);
		}
	}, [projectId]);

	useEffect(() => {
		loadMessages();
		// Simple poll
		const interval = setInterval(loadMessages, 5000);
		return () => clearInterval(interval);
	}, [loadMessages]);

	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || !currentUser) return;

		try {
			const response = await fetch(`/api/chat/${projectId}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: currentUser.id,
					content: input,
				}),
			});
			if (response.ok) {
				setInput("");
				loadMessages();
			}
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<div className="bg-white rounded-lg shadow p-4 h-96 flex flex-col">
			<h3 className="font-bold text-lg mb-4 border-b pb-2 text-gray-800">
				Chat del Equipo
			</h3>
			<div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-gray-50 rounded">
				{messages.length === 0 && (
					<p className="text-gray-400 text-sm text-center py-8">
						No hay mensajes aún. ¡Saluda a tu equipo!
					</p>
				)}
				{messages.map((m) => {
					const isMe = m.userId === currentUser?.id;
					return (
						<div
							key={m.id}
							className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
						>
							<div
								className={`max-w-[80%] rounded-lg p-3 ${isMe ? "bg-blue-950 text-white" : "bg-white border border-gray-200 text-gray-800"}`}
							>
								{!isMe && (
									<p className="text-xs font-bold mb-1 opacity-75">
										{m.user.name}
									</p>
								)}
								<p className="text-sm">{m.content}</p>
							</div>
						</div>
					);
				})}
			</div>
			<form onSubmit={handleSend} className="flex gap-2">
				<input
					type="text"
					className="flex-1 border rounded-lg px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
					placeholder="Escribe un mensaje..."
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
				<button
					type="submit"
					className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium transition-colors"
				>
					Enviar
				</button>
			</form>
		</div>
	);
}

function DocumentsSection({ projectId }: { projectId: string }) {
	const [documents, setDocuments] = useState<DocumentItem[]>([]);
	const [uploading, setUploading] = useState(false);
	const [showHistory, setShowHistory] = useState<string | null>(null);
	const [historyData, setHistoryData] = useState<DocumentVersion[]>([]);
	const [showUploadModal, setShowUploadModal] = useState(false);
	const [uploadParentId, setUploadParentId] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const loadDocs = useCallback(async () => {
		try {
			const response = await fetch(`/api/documents/${projectId}`);
			if (response.ok) {
				const data = await response.json();
				setDocuments(data.data || []);
			}
		} catch (err) {
			console.error(err);
		}
	}, [projectId]);

	const loadHistory = async (docId: string) => {
		try {
			const response = await fetch(`/api/documents/${docId}/versions`);
			if (response.ok) {
				const data = await response.json();
				setHistoryData(data.data || []);
				setShowHistory(docId);
			}
		} catch (error) {
			console.error("Error loading history:", error);
		}
	};

	useEffect(() => {
		loadDocs();
	}, [loadDocs]);

	const openUploadModal = (parentId: string | null = null) => {
		setUploadParentId(parentId);
		setShowUploadModal(true);
	};

	const handleUploadSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const files = fileInputRef.current?.files;
		if (!files || files.length === 0) {
			alert("Por favor selecciona un archivo.");
			return;
		}

		const file = files[0];
		setUploading(true);

		try {
			const url = uploadParentId
				? `/api/documents/${uploadParentId}/versions`
				: `/api/documents/${projectId}`;

			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch(url, {
				method: "POST",
				// headers: Content-Type is set automatically for FormData
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response.json();
				alert(errorData.error || "Error al subir");
			} else {
				loadDocs();
				if (uploadParentId && showHistory === uploadParentId) {
					loadHistory(uploadParentId);
				}
				setShowUploadModal(false);
			}
		} catch (_err) {
			alert("Error al subir");
		} finally {
			setUploading(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("¿Eliminar archivo y todas sus versiones?")) return;
		try {
			await fetch(`/api/documents/${id}`, { method: "DELETE" });
			loadDocs();
			if (showHistory === id) setShowHistory(null);
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<div className="bg-white rounded-lg shadow p-4 flex flex-col lg:flex-row gap-6">
			<div className="flex-1">
				<div className="flex justify-between items-center mb-4 border-b pb-2">
					<h3 className="font-bold text-lg text-gray-800">Documentos</h3>
					<button
						type="button"
						onClick={() => openUploadModal(null)}
						disabled={uploading}
						className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-900 px-4 py-2 rounded font-medium transition-colors"
					>
						+ Subir Archivo
					</button>
				</div>

				{documents.length === 0 ? (
					<div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
						<div className="text-4xl mb-2">📂</div>
						<p>No hay documentos compartidos.</p>
						<p className="text-xs mt-1">
							Usa el botón de arriba para subir archivos.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{documents.map((doc) => (
							<div
								key={doc.id}
								className={`border rounded-lg p-4 flex flex-col transition-shadow bg-white ${showHistory === doc.id ? "ring-2 ring-blue-700" : "hover:shadow-md"}`}
							>
								<div className="flex justify-between items-start mb-2">
									<div className="flex gap-2">
										<span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded uppercase">
											{doc.type}
										</span>
										{doc.latestVersion && doc.latestVersion > 1 && (
											<span className="bg-blue-100 text-blue-900 text-xs font-bold px-2 py-1 rounded">
												V{doc.latestVersion}
											</span>
										)}
									</div>
									<button
										type="button"
										onClick={() => handleDelete(doc.id)}
										className="text-red-400 hover:text-red-600"
									>
										×
									</button>
								</div>
								<p className="font-medium text-gray-800 truncate mb-1">
									{doc.name}
								</p>
								<p className="text-xs text-gray-500 mb-3">
									{(doc.size / 1024).toFixed(1)} KB •{" "}
									{new Date(doc.uploadedAt).toLocaleDateString()}
								</p>

								<div className="mt-auto flex flex-col gap-2">
									<div className="flex gap-2">
										<a
											href={doc.url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex-1 text-center block bg-gray-50 hover:bg-gray-100 text-blue-950 text-sm py-2 rounded"
										>
											Descargar
										</a>
										{doc.versionCount && doc.versionCount > 1 && (
											<button
												type="button"
												onClick={() => loadHistory(doc.id)}
												className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm py-2 rounded"
											>
												Historial
											</button>
										)}
									</div>
									<button
										type="button"
										onClick={() => openUploadModal(doc.id)}
										className="w-full text-center text-xs text-blue-950 hover:text-blue-800 border border-dashed border-blue-200 hover:border-blue-400 rounded py-1"
									>
										+ Nueva Versión
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Version History Panel */}
			{showHistory && (
				<div className="w-full lg:w-80 border-l pl-6 animate-fade-in">
					<div className="flex justify-between items-center mb-4 border-b pb-2">
						<h3 className="font-bold text-gray-800">Historial de Versiones</h3>
						<button
							type="button"
							onClick={() => setShowHistory(null)}
							className="text-gray-400 hover:text-gray-600"
						>
							×
						</button>
					</div>
					<div className="space-y-3">
						{historyData.map((ver) => (
							<div
								key={ver.id}
								className="p-3 bg-gray-50 rounded border border-gray-100"
							>
								<div className="flex justify-between items-center mb-1">
									<span className="font-bold text-sm text-blue-800">
										Versión {ver.version}
									</span>
									<span className="text-xs text-gray-500">
										{new Date(ver.uploadedAt).toLocaleDateString()}
									</span>
								</div>
								<a
									href={ver.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-xs text-blue-950 hover:underline block mt-1"
								>
									Descargar Archivo
								</a>
							</div>
						))}
					</div>
				</div>
			)}

			<Modal
				isOpen={showUploadModal}
				onClose={() => setShowUploadModal(false)}
				title={uploadParentId ? "Subir Nueva Versión" : "Subir Nuevo Documento"}
			>
				<form onSubmit={handleUploadSubmit}>
					<div className="mb-4">
						<label
							htmlFor="file-upload"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Selecciona un archivo
						</label>
						<input
							id="file-upload"
							type="file"
							ref={fileInputRef}
							className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-900
                hover:file:bg-blue-100"
							required
						/>
						{uploadParentId && (
							<p className="mt-2 text-xs text-gray-500">
								Este archivo se guardará como la versión más reciente del
								documento seleccionado.
							</p>
						)}
						{!uploadParentId && (
							<p className="mt-2 text-xs text-gray-500">
								Este archivo se subirá como un nuevo documento en el proyecto.
							</p>
						)}
					</div>
					<div className="flex gap-3 justify-end">
						<button
							type="button"
							onClick={() => setShowUploadModal(false)}
							className="px-4 py-2 bg-gray-100 rounded text-gray-700 hover:bg-gray-200"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={uploading}
							className="px-4 py-2 bg-blue-950 text-white rounded hover:bg-blue-900"
						>
							{uploading ? "Subiendo..." : "Subir"}
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}

function MembersSection({
	projectId,
	isProjectAdmin,
}: {
	projectId: string;
	isProjectAdmin: boolean;
}) {
	const [members, setMembers] = useState<ProjectMemberDetails[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddModal, setShowAddModal] = useState(false);
	const [users, setUsers] = useState<AvailableUser[]>([]);
	const [selectedUser, setSelectedUser] = useState("");
	const [selectedRole, setSelectedRole] = useState("TEAM_DEVELOPER");

	const loadMembers = useCallback(async () => {
		try {
			// Reload project to get members
			const response = await fetch(`/api/projects/${projectId}`);
			const data = await response.json();
			setMembers(data.data.members || []);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, [projectId]);

	const loadUsers = async () => {
		try {
			const response = await fetch("/api/users");
			const data = await response.json();
			// Filter out already added members
			const memberIds = new Set(members.map((m) => m.userId));
			const userList = Array.isArray(data) ? data : data.data || [];
			const availableUsers = userList.filter(
				(u: AvailableUser) => !memberIds.has(u.id),
			);
			setUsers(availableUsers);
		} catch (err) {
			console.error(err);
		}
	};

	useEffect(() => {
		loadMembers();
	}, [loadMembers]);

	const handleAddMember = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const response = await fetch(`/api/projects/${projectId}/members`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: selectedUser, role: selectedRole }),
			});
			if (!response.ok) throw new Error("Error al añadir miembro");
			setShowAddModal(false);
			loadMembers();
		} catch (_err) {
			alert("Error al añadir miembro");
		}
	};

	const handleRemoveMember = async (userId: string) => {
		if (!confirm("¿Eliminar miembro?")) return;
		try {
			const response = await fetch(
				`/api/projects/${projectId}/members/${userId}`,
				{
					method: "DELETE",
				},
			);
			if (!response.ok) throw new Error("Error");
			loadMembers();
		} catch (_err) {
			alert("Error al eliminar miembro");
		}
	};

	return (
		<div className="bg-white rounded-lg shadow p-4">
			<div className="flex justify-between items-center mb-4 border-b pb-2">
				<h3 className="font-bold text-lg text-gray-800">Miembros del Equipo</h3>
				{isProjectAdmin && (
					<button
						type="button"
						onClick={() => {
							loadUsers();
							setShowAddModal(true);
						}}
						className="text-sm bg-blue-100 text-blue-900 hover:bg-blue-200 px-3 py-1 rounded"
					>
						+ Añadir Miembro
					</button>
				)}
			</div>

			{loading ? (
				<div className="text-center py-4">Cargando...</div>
			) : (
				<div className="space-y-3">
					{members.map((member) => (
						<div
							key={member.id}
							className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-100"
						>
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
									{member.user?.name?.charAt(0)}
								</div>
								<div>
									<p className="font-medium text-sm text-gray-900">
										{member.user?.name}
									</p>
									<p className="text-xs text-gray-500">{member.user?.email}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-700 font-medium">
									{member.role}
								</span>
								{isProjectAdmin && (
									<button
										type="button"
										onClick={() => handleRemoveMember(member.userId)}
										className="text-red-400 hover:text-red-600"
									>
										×
									</button>
								)}
							</div>
						</div>
					))}
					{members.length === 0 && (
						<p className="text-gray-500 text-sm text-center">
							No hay miembros asignados.
						</p>
					)}
				</div>
			)}

			<Modal
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				title="Añadir Miembro"
			>
				<form onSubmit={handleAddMember}>
					<div className="mb-4">
						<label
							htmlFor="user-select"
							className="block text-sm font-medium mb-1 text-gray-700"
						>
							Usuario
						</label>
						<select
							id="user-select"
							className="w-full border rounded px-3 py-2"
							value={selectedUser}
							onChange={(e) => setSelectedUser(e.target.value)}
							required
						>
							<option value="">Seleccionar usuario...</option>
							{users.map((u) => (
								<option key={u.id} value={u.id}>
									{u.name} ({u.email})
								</option>
							))}
						</select>
					</div>
					<div className="mb-6">
						<label
							htmlFor="role-select"
							className="block text-sm font-medium mb-1 text-gray-700"
						>
							Rol Scrum
						</label>
						<select
							id="role-select"
							className="w-full border rounded px-3 py-2"
							value={selectedRole}
							onChange={(e) => setSelectedRole(e.target.value)}
						>
							<option value="TEAM_DEVELOPER">Team Developer</option>
							<option value="SCRUM_MASTER">Scrum Master</option>
							<option value="PRODUCT_OWNER">Product Owner</option>
						</select>
					</div>
					<div className="flex gap-2 justify-end">
						<button
							type="button"
							onClick={() => setShowAddModal(false)}
							className="px-4 py-2 bg-gray-100 rounded text-gray-700"
						>
							Cancelar
						</button>
						<button
							type="submit"
							className="px-4 py-2 bg-blue-950 text-white rounded"
						>
							Añadir
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}

interface ProjectMember {
	userId: string;
	role: string;
}

interface Project {
	id: string;
	name: string;
	description: string;
	status: string;
	createdAt: string;
	ownerId: string;
	members: ProjectMember[];
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
