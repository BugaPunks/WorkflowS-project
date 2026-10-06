import { ArrowRight, Calendar, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectAPI } from "@/api/client";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

interface Project {
	id: string;
	name: string;
	description: string;
	status: string;
	startDate?: string;
	endDate?: string;
	createdAt: string;
}

export default function Projects() {
	const navigate = useNavigate();
	const { session: user } = useSession();
	const [projects, setProjects] = useState<Project[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		description: "",
		startDate: "",
		endDate: "",
	});

	const loadProjects = useCallback(async (userId?: string) => {
		try {
			setIsLoading(true);
			const projectsData = await projectAPI.getAll({
				memberId: userId,
			});
			setProjects((projectsData as Project[]) || []);
		} catch (err) {
			setError("Error al cargar los proyectos");
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (user) {
			loadProjects(user.id);
		}
	}, [user, loadProjects]);

	const handleCreateProject = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (!user) {
				throw new Error("Usuario no autenticado");
			}

			const projectData = {
				name: formData.name,
				description: formData.description,
				ownerId: user.id,
				startDate: formData.startDate,
				endDate: formData.endDate,
			};

			await projectAPI.create(projectData);
			setFormData({
				name: "",
				description: "",
				startDate: "",
				endDate: "",
			});
			setShowModal(false);
			if (user) await loadProjects(user.id);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Error al crear el proyecto",
			);
			console.error(err);
		}
	};

	const handleDeleteProject = async (id: string) => {
		if (!confirm("¿Estás seguro de que quieres eliminar este proyecto?"))
			return;
		try {
			await projectAPI.delete(id);
			if (user) await loadProjects(user.id);
		} catch (err) {
			setError("Error al eliminar el proyecto");
			console.error(err);
		}
	};

	const canCreateProject =
		user?.role === "ADMIN" || user?.role === "PRODUCT_OWNER";

	return (
		<div className="animate-in fade-in duration-500">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
				<div>
					<h2 className="text-2xl font-bold text-gray-900 tracking-tight">
						Proyectos
					</h2>
					<p className="text-gray-500 mt-1 text-sm">
						Gestiona tus proyectos y colabora con tu equipo
					</p>
				</div>
				{canCreateProject && (
					<Button
						onClick={() => setShowModal(true)}
						variant="primary"
						className="gap-2 shadow-lg shadow-blue-700/20"
					>
						<Plus size={18} />
						Nuevo Proyecto
					</Button>
				)}
			</div>

			{/* Error Message */}
			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
					<div className="w-2 h-2 rounded-full bg-red-600" />
					{error}
				</div>
			)}

			{/* Loading */}
			{isLoading && (
				<div className="text-center py-20">
					<div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-950 border-t-transparent" />
					<p className="text-gray-500 mt-4 text-sm font-medium">
						Cargando proyectos...
					</p>
				</div>
			)}

			{/* Projects Grid */}
			{!isLoading && projects.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{projects.map((project) => (
						<div
							key={project.id}
							className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6 relative overflow-hidden flex flex-col"
						>
							{/* Status Badge */}
							<div className="absolute top-6 right-6">
								<span
									className={cn(
										"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800",
										project.status === "COMPLETED" &&
											"bg-gray-100 text-gray-800",
										project.status === "IN_PROGRESS" &&
											"bg-blue-100 text-blue-800",
									)}
								>
									{project.status || "ACTIVO"}
								</span>
							</div>

							<div className="mb-4 pr-20">
								<h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-950 transition-colors line-clamp-1">
									<button
										type="button"
										onClick={() => navigate(`/projects/${project.id}`)}
										className="hover:underline focus:outline-none"
									>
										{project.name}
									</button>
								</h3>
								<div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
									<Calendar size={14} />
									<span>
										{new Date(project.createdAt).toLocaleDateString(undefined, {
											year: "numeric",
											month: "short",
											day: "numeric",
										})}
									</span>
								</div>
							</div>

							<p className="text-gray-600 mb-6 text-sm line-clamp-2 h-10 leading-relaxed flex-1">
								{project.description || "Sin descripción"}
							</p>

							<div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
								<Button
									variant="ghost"
									size="sm"
									className="text-blue-950 hover:text-blue-900 hover:bg-blue-50 -ml-2 px-2 gap-1"
									onClick={() => navigate(`/projects/${project.id}`)}
								>
									Ver Proyecto
									<ArrowRight size={16} />
								</Button>

								{canCreateProject && (
									<button
										type="button"
										onClick={() => handleDeleteProject(project.id)}
										className="text-gray-400 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-colors"
										title="Eliminar proyecto"
									>
										<Trash2 size={16} />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Empty State */}
			{!isLoading && projects.length === 0 && (
				<div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
					<div className="w-16 h-16 bg-blue-50 text-blue-950 rounded-full flex items-center justify-center mx-auto mb-4">
						<FolderOpen size={32} />
					</div>
					<h3 className="text-lg font-semibold text-gray-900 mb-1">
						No hay proyectos
					</h3>
					<p className="text-gray-500 mb-6 max-w-xs mx-auto text-sm">
						{canCreateProject
							? "Comienza creando tu primer proyecto para gestionar tu equipo."
							: "Aún no tienes proyectos asignados."}
					</p>
					{canCreateProject && (
						<Button onClick={() => setShowModal(true)} variant="primary">
							Crear Primer Proyecto
						</Button>
					)}
				</div>
			)}

			{/* Modal */}
			<Modal
				isOpen={showModal && canCreateProject}
				onClose={() => setShowModal(false)}
				title="Nuevo Proyecto"
			>
				<form onSubmit={handleCreateProject}>
					<div className="space-y-4">
						<div>
							<label
								htmlFor="project-name"
								className="block text-sm font-medium text-gray-700 mb-1.5"
							>
								Nombre del proyecto
							</label>
							<input
								id="project-name"
								name="name"
								type="text"
								value={formData.name}
								onChange={(e) =>
									setFormData({ ...formData, name: e.target.value })
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-all text-sm"
								placeholder="Ej. Sistema de Gestión..."
								required
							/>
						</div>
						<div>
							<label
								htmlFor="project-desc"
								className="block text-sm font-medium text-gray-700 mb-1.5"
							>
								Descripción
							</label>
							<textarea
								id="project-desc"
								name="description"
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-all text-sm resize-none"
								placeholder="Breve descripción del proyecto..."
								rows={3}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label
									htmlFor="start-date"
									className="block text-sm font-medium text-gray-700 mb-1.5"
								>
									Inicio
								</label>
								<input
									id="start-date"
									type="date"
									value={formData.startDate}
									onChange={(e) =>
										setFormData({ ...formData, startDate: e.target.value })
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-all text-sm text-gray-600"
								/>
							</div>
							<div>
								<label
									htmlFor="end-date"
									className="block text-sm font-medium text-gray-700 mb-1.5"
								>
									Fin
								</label>
								<input
									id="end-date"
									type="date"
									value={formData.endDate}
									onChange={(e) =>
										setFormData({ ...formData, endDate: e.target.value })
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-all text-sm text-gray-600"
								/>
							</div>
						</div>
					</div>

					<div className="flex gap-3 mt-8">
						<Button
							type="button"
							onClick={() => setShowModal(false)}
							variant="default"
							className="flex-1"
						>
							Cancelar
						</Button>
						<Button type="submit" variant="primary" className="flex-1">
							Crear Proyecto
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
