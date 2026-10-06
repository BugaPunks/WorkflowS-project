import { useCallback, useEffect, useState } from "react";
import { projectAPI } from "@/api/client";
import { Modal } from "@/components/Modal";
import { useSession } from "@/hooks/useSession";

interface UserStory {
	id: string;
	title: string;
	description: string;
	acceptance?: string;
	status: string;
	priority: string;
	createdAt: string;
}

interface Project {
	id: string;
	name: string;
}

export default function UserStories() {
	const { session: user } = useSession();
	const [stories, setStories] = useState<UserStory[]>([]);
	const [projects, setProjects] = useState<Project[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		acceptance: "",
		priority: "MEDIUM",
		projectId: "",
	});

	const loadStories = useCallback(async () => {
		try {
			setIsLoading(true);
			const response = await fetch("/api/user-stories");
			if (!response.ok) throw new Error("Error al cargar historias");
			const data = await response.json();
			setStories(data.data || []);
		} catch (err) {
			setError("Error al cargar las historias");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const loadProjects = useCallback(async (userId?: string) => {
		try {
			const projectsData = (await projectAPI.getAll({
				memberId: userId,
			})) as Project[];
			setProjects(projectsData || []);
		} catch (err) {
			console.error("Error al cargar proyectos:", err);
		}
	}, []);

	useEffect(() => {
		if (user) {
			loadStories();
			loadProjects(user.id);
		}
	}, [user, loadStories, loadProjects]);

	const handleCreateStory = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const response = await fetch("/api/user-stories", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});
			if (!response.ok) throw new Error("Error al crear historia");
			setFormData({
				title: "",
				description: "",
				acceptance: "",
				priority: "MEDIUM",
				projectId: "",
			});
			setShowModal(false);
			await loadStories();
		} catch (err) {
			setError("Error al crear la historia");
			console.error(err);
		}
	};

	const handleDeleteStory = async (id: string) => {
		if (!confirm("¿Estás seguro de que quieres eliminar esta historia?"))
			return;
		try {
			const response = await fetch(`/api/user-stories/${id}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error("Error al eliminar historia");
			await loadStories();
		} catch (err) {
			setError("Error al eliminar la historia");
			console.error(err);
		}
	};

	const getPriorityColor = (priority: string) => {
		const colors: Record<string, string> = {
			LOW: "bg-green-100 text-green-700",
			MEDIUM: "bg-yellow-100 text-yellow-700",
			HIGH: "bg-orange-100 text-orange-700",
			CRITICAL: "bg-red-100 text-red-700",
		};
		return colors[priority] || "bg-gray-100 text-gray-700";
	};

	return (
		<div className="p-8 max-w-7xl mx-auto">
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h2 className="text-3xl font-bold text-gray-900">
						Historias de Usuario
					</h2>
					<p className="text-gray-600 mt-2">
						Define los requisitos de tu proyecto
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowModal(true)}
					className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
				>
					+ Nueva Historia
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
					<p className="text-gray-600 mt-4">Cargando historias...</p>
				</div>
			)}

			{/* Stories Grid */}
			{!isLoading && stories.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{stories.map((story) => (
						<div
							key={story.id}
							className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 flex flex-col"
						>
							<div className="flex items-start justify-between mb-4">
								<div className="flex-1">
									<h3 className="text-lg font-semibold text-gray-900">
										{story.title}
									</h3>
									<p className="text-sm text-gray-500 mt-1">
										{new Date(story.createdAt).toLocaleDateString()}
									</p>
								</div>
								<span
									className={`inline-block px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getPriorityColor(story.priority)}`}
								>
									{story.priority || "MEDIUM"}
								</span>
							</div>
							<p className="text-gray-600 mb-4 flex-1">{story.description}</p>

							{story.acceptance && (
								<div className="mb-4 p-3 bg-gray-50 rounded-md text-sm border border-gray-200">
									<span className="font-semibold text-gray-700 block mb-1">
										Criterios de Aceptación:
									</span>
									<p className="text-gray-600">{story.acceptance}</p>
								</div>
							)}

							<div className="flex items-center justify-between mt-auto">
								<span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-900">
									{story.status || "PENDING"}
								</span>
								<button
									type="button"
									onClick={() => handleDeleteStory(story.id)}
									className="text-red-600 hover:text-red-700 font-medium text-sm"
								>
									Eliminar
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Empty State */}
			{!isLoading && stories.length === 0 && (
				<div className="text-center py-16">
					<div className="text-5xl mb-4">📖</div>
					<h3 className="text-xl font-semibold text-gray-900 mb-2">
						No hay historias
					</h3>
					<p className="text-gray-600 mb-6">
						Comienza definiendo las primeras historias de usuario
					</p>
					<button
						type="button"
						onClick={() => setShowModal(true)}
						className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
					>
						Crear Historia
					</button>
				</div>
			)}

			{/* Modal */}
			<Modal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title="Crear Nueva Historia"
			>
				<form onSubmit={handleCreateStory}>
					<div className="mb-4">
						<label
							htmlFor="story-project"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Proyecto
						</label>
						<select
							id="story-project"
							value={formData.projectId}
							onChange={(e) =>
								setFormData({ ...formData, projectId: e.target.value })
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
					<div className="mb-4">
						<label
							htmlFor="story-title"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Título
						</label>
						<input
							id="story-title"
							type="text"
							value={formData.title}
							onChange={(e) =>
								setFormData({ ...formData, title: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							placeholder="Como usuario... quiero..."
							required
						/>
					</div>
					<div className="mb-4">
						<label
							htmlFor="story-desc"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Descripción
						</label>
						<textarea
							id="story-desc"
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							placeholder="Criterios de aceptación..."
							rows={3}
						/>
					</div>
					<div className="mb-4">
						<label
							htmlFor="story-acceptance"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Criterios de Aceptación
						</label>
						<textarea
							id="story-acceptance"
							value={formData.acceptance}
							onChange={(e) =>
								setFormData({ ...formData, acceptance: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							placeholder="Dado que... cuando... entonces..."
							rows={3}
						/>
					</div>
					<div className="mb-6">
						<label
							htmlFor="story-priority"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Prioridad
						</label>
						<select
							id="story-priority"
							value={formData.priority}
							onChange={(e) =>
								setFormData({ ...formData, priority: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
						>
							<option value="LOW">Baja</option>
							<option value="MEDIUM">Media</option>
							<option value="HIGH">Alta</option>
							<option value="CRITICAL">Crítica</option>
						</select>
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
