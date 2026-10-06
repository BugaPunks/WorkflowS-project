import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useSession } from "@/hooks/useSession";

interface Project {
	id: string;
	name: string;
}

interface Criteria {
	id: string | number;
	name: string;
	maxScore: number;
	weight: number;
}

interface Rubric {
	id: string;
	name: string;
	description?: string;
	criteria: Criteria[];
	projectId?: string | null;
}

interface RubricPayload {
	projectId?: string | null;
	name: string;
	description: string;
	criteria: Criteria[];
}

export default function Rubrics() {
	const { session: user } = useSession();
	const [projects, setProjects] = useState<Project[]>([]);
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);
	const [rubrics, setRubrics] = useState<Rubric[]>([]);
	const [globalRubrics, setGlobalRubrics] = useState<Rubric[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [showModal, setShowModal] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [currentRubricId, setCurrentRubricId] = useState<string | null>(null);
	const [formData, setFormData] = useState<{
		name: string;
		description: string;
		criteria: Criteria[];
		projectId: string | null;
	}>({
		name: "",
		description: "",
		criteria: [{ id: Date.now(), name: "", maxScore: 10, weight: 1 }],
		projectId: null,
	});

	const loadProjects = useCallback(async () => {
		try {
			const response = await fetch("/api/projects");
			const data = await response.json();
			const projectsList = Array.isArray(data) ? data : data.data || [];
			setProjects(projectsList);
		} catch (error) {
			console.error("Error loading projects:", error);
		}
	}, []);

	const loadRubrics = useCallback(async (projectId?: string | null) => {
		try {
			setIsLoading(true);
			let url = "/api/rubrics";
			if (projectId) {
				url += `?projectId=${projectId}`;
			}
			const response = await fetch(url);
			const data = await response.json();

			if (projectId) {
				// Filter to show only project specific rubrics in the project section
				const allRubrics = data.data || [];
				const projectRubrics = allRubrics.filter(
					(r: Rubric) => r.projectId === projectId,
				);
				setRubrics(projectRubrics);
			} else {
				setGlobalRubrics(data.data || []);
			}
		} catch (error) {
			console.error("Error loading rubrics:", error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadProjects();
		loadRubrics(); // Load global rubrics initially
	}, [loadProjects, loadRubrics]);

	useEffect(() => {
		if (selectedProject) {
			loadRubrics(selectedProject.id);
		} else {
			setRubrics([]);
		}
	}, [selectedProject, loadRubrics]);

	const openCreateModal = (forProject: boolean = false) => {
		setIsEditing(false);
		setCurrentRubricId(null);
		setFormData({
			name: "",
			description: "",
			criteria: [{ id: Date.now(), name: "", maxScore: 10, weight: 1 }],
			projectId: forProject && selectedProject ? selectedProject.id : null,
		});
		setShowModal(true);
	};

	const openEditModal = (rubric: Rubric) => {
		setIsEditing(true);
		setCurrentRubricId(rubric.id);
		setFormData({
			name: rubric.name,
			description: rubric.description || "",
			criteria: rubric.criteria.map((c) => ({
				id: c.id,
				name: c.name,
				maxScore: c.maxScore,
				weight: c.weight,
			})),
			projectId: rubric.projectId || null,
		});
		setShowModal(true);
	};

	const handleSaveRubric = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		try {
			const url = isEditing
				? `/api/rubrics/${currentRubricId}`
				: "/api/rubrics";
			const method = isEditing ? "PUT" : "POST";

			const body: RubricPayload = {
				name: formData.name,
				description: formData.description,
				criteria: formData.criteria.filter((c) => c.name.trim() !== ""),
				projectId: formData.projectId,
			};

			const response = await fetch(url, {
				method: method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!response.ok) throw new Error("Error saving rubric");

			setShowModal(false);
			// Reload both to be safe or check projectId
			if (body.projectId) {
				loadRubrics(body.projectId);
			} else {
				loadRubrics();
			}
		} catch (error) {
			console.error("Error saving rubric:", error);
			alert("Error al guardar la rúbrica");
		}
	};

	const handleDeleteRubric = async (id: string, projectId?: string | null) => {
		if (!confirm("¿Estás seguro de que quieres eliminar esta rúbrica?")) return;

		try {
			const response = await fetch(`/api/rubrics/${id}`, {
				method: "DELETE",
			});

			if (!response.ok) throw new Error("Error deleting rubric");

			if (projectId) {
				loadRubrics(projectId);
			} else {
				loadRubrics();
			}
		} catch (error) {
			console.error("Error deleting rubric:", error);
			alert("Error al eliminar la rúbrica");
		}
	};

	const addCriteria = () => {
		setFormData({
			...formData,
			criteria: [
				...formData.criteria,
				{ id: Date.now() + Math.random(), name: "", maxScore: 10, weight: 1 },
			],
		});
	};

	const updateCriteria = (
		id: string | number,
		field: string,
		value: string | number,
	) => {
		const newCriteria = formData.criteria.map((c) =>
			c.id === id ? { ...c, [field]: value } : c,
		);
		setFormData({ ...formData, criteria: newCriteria });
	};

	const removeCriteria = (id: string | number) => {
		if (formData.criteria.length > 1) {
			setFormData({
				...formData,
				criteria: formData.criteria.filter((c) => c.id !== id),
			});
		}
	};

	const renderRubricCard = (rubric: Rubric) => (
		<div
			key={rubric.id}
			className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col transition hover:shadow-lg"
		>
			<div className="flex-1">
				<div className="flex justify-between items-start mb-2">
					<h3 className="font-bold text-gray-900">{rubric.name}</h3>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => openEditModal(rubric)}
							className="text-blue-950 hover:text-blue-950 text-sm font-medium"
						>
							Editar
						</button>
						<button
							type="button"
							onClick={() => handleDeleteRubric(rubric.id, rubric.projectId)}
							className="text-red-600 hover:text-red-900 text-sm font-medium"
						>
							Eliminar
						</button>
					</div>
				</div>
				{rubric.description && (
					<p className="text-gray-600 text-sm mb-4">{rubric.description}</p>
				)}
				<div className="space-y-2 mt-4">
					<h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
						Criterios:
					</h4>
					{rubric.criteria.map((criterion) => (
						<div
							key={criterion.id}
							className="text-sm text-gray-600 flex justify-between"
						>
							<span>{criterion.name}</span>
							<span className="text-gray-400">
								{criterion.weight}x / {criterion.maxScore}pts
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">
						Gestión de Rúbricas
					</h1>
					<p className="text-gray-600 mt-2">
						Define y gestiona los criterios de evaluación.
					</p>
				</div>
			</div>

			{/* Global Rubrics Section */}
			<div className="mb-12">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-bold text-gray-800">
						Rúbricas Globales (Plantillas)
					</h2>
					<button
						type="button"
						onClick={() => openCreateModal(false)}
						className="bg-blue-950 text-white px-4 py-2 rounded-lg hover:bg-blue-900 font-medium text-sm flex items-center gap-2"
					>
						<span>+</span> Nueva Rúbrica Global
					</button>
				</div>

				{isLoading && globalRubrics.length === 0 ? (
					<div className="text-center py-8">
						<div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-950" />
					</div>
				) : globalRubrics.length === 0 ? (
					<div className="bg-gray-50 rounded-lg p-8 text-center border border-dashed border-gray-300">
						<p className="text-gray-500">No hay rúbricas globales definidas.</p>
						<button
							type="button"
							onClick={() => openCreateModal(false)}
							className="text-blue-950 hover:underline mt-2 text-sm"
						>
							Crear la primera plantilla
						</button>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{globalRubrics.map(renderRubricCard)}
					</div>
				)}
			</div>

			<hr className="my-8 border-gray-200" />

			{/* Project Specific Rubrics Section */}
			<div>
				<div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
					<h2 className="text-xl font-bold text-gray-800">
						Rúbricas por Proyecto
					</h2>
					<div className="flex items-center gap-4">
						<select
							id="project-select"
							value={selectedProject?.id || ""}
							onChange={(e) => {
								const project = projects.find((p) => p.id === e.target.value);
								setSelectedProject(project || null);
							}}
							className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 min-w-[250px]"
						>
							<option value="">Selecciona un proyecto...</option>
							{projects.map((project) => (
								<option key={project.id} value={project.id}>
									{project.name}
								</option>
							))}
						</select>

						{selectedProject && (
							<button
								type="button"
								onClick={() => openCreateModal(true)}
								className="bg-white text-blue-950 border border-blue-950 px-4 py-2 rounded-lg hover:bg-blue-50 font-medium text-sm whitespace-nowrap"
							>
								+ Rúbrica para {selectedProject.name}
							</button>
						)}
					</div>
				</div>

				{selectedProject ? (
					isLoading && rubrics.length === 0 ? (
						<div className="text-center py-8">
							<div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-950" />
						</div>
					) : rubrics.length === 0 ? (
						<div className="bg-gray-50 rounded-lg p-8 text-center border border-dashed border-gray-300">
							<p className="text-gray-500">
								No hay rúbricas específicas para {selectedProject.name}.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{rubrics.map(renderRubricCard)}
						</div>
					)
				) : (
					<div className="bg-gray-50 rounded-lg p-8 text-center">
						<p className="text-gray-500">
							Selecciona un proyecto para ver sus rúbricas específicas.
						</p>
					</div>
				)}
			</div>

			{/* Modal for Creating/Editing Rubric */}
			<Modal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title={isEditing ? "Editar Rúbrica" : "Crear Nueva Rúbrica"}
				className="max-w-2xl"
			>
				<div className="mb-6 bg-blue-50 text-blue-800 px-4 py-2 rounded-md text-sm">
					{formData.projectId
						? `Esta rúbrica será específica para el proyecto: ${projects.find((p) => p.id === formData.projectId)?.name}`
						: "Esta será una rúbrica global (plantilla) disponible para todos los proyectos."}
				</div>

				<form onSubmit={handleSaveRubric}>
					<div className="mb-4">
						<label
							htmlFor="rubric-name"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Nombre de la Rúbrica
						</label>
						<input
							id="rubric-name"
							type="text"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							placeholder="Ej: Rúbrica de Calidad de Código"
							required
						/>
					</div>
					<div className="mb-6">
						<label
							htmlFor="rubric-desc"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Descripción (opcional)
						</label>
						<textarea
							id="rubric-desc"
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
							rows={3}
							placeholder="Describe el propósito de esta rúbrica..."
						/>
					</div>

					<div className="mb-6">
						<div className="flex items-center justify-between mb-4">
							<h4 className="text-lg font-semibold text-gray-800">
								Criterios de Evaluación
							</h4>
							<button
								type="button"
								onClick={addCriteria}
								className="text-blue-950 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
							>
								<span>+</span> Agregar Criterio
							</button>
						</div>
						<div className="space-y-4">
							{formData.criteria.map((criterion, _index) => (
								<div
									key={criterion.id}
									className="flex flex-wrap sm:flex-nowrap items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
								>
									<div className="flex-1 w-full sm:w-auto">
										<label
											htmlFor={`criterion-name-${criterion.id}`}
											className="block text-xs font-medium text-gray-500 mb-1 uppercase"
										>
											Criterio
										</label>
										<input
											id={`criterion-name-${criterion.id}`}
											type="text"
											value={criterion.name}
											onChange={(e) =>
												updateCriteria(criterion.id, "name", e.target.value)
											}
											className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
											placeholder="Ej: Funcionalidad"
											required
										/>
									</div>
									<div className="w-24">
										<label
											htmlFor={`criterion-max-${criterion.id}`}
											className="block text-xs font-medium text-gray-500 mb-1 uppercase"
										>
											Max Pts
										</label>
										<input
											id={`criterion-max-${criterion.id}`}
											type="number"
											min="1"
											max="100"
											value={criterion.maxScore}
											onChange={(e) =>
												updateCriteria(
													criterion.id,
													"maxScore",
													parseInt(e.target.value, 10) || 10,
												)
											}
											className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
										/>
									</div>
									<div className="w-24">
										<label
											htmlFor={`criterion-weight-${criterion.id}`}
											className="block text-xs font-medium text-gray-500 mb-1 uppercase"
										>
											Peso
										</label>
										<input
											id={`criterion-weight-${criterion.id}`}
											type="number"
											min="1"
											value={criterion.weight}
											onChange={(e) =>
												updateCriteria(
													criterion.id,
													"weight",
													parseInt(e.target.value, 10) || 1,
												)
											}
											className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
										/>
									</div>
									{formData.criteria.length > 1 && (
										<button
											type="button"
											onClick={() => removeCriteria(criterion.id)}
											className="text-red-600 hover:text-red-700 mt-6 p-1 hover:bg-red-50 rounded"
											title="Eliminar criterio"
										>
											✕
										</button>
									)}
								</div>
							))}
						</div>
					</div>

					<div className="flex gap-3 pt-4 border-t border-gray-100">
						<button
							type="button"
							onClick={() => setShowModal(false)}
							className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
						>
							Cancelar
						</button>
						<button
							type="submit"
							className="flex-1 px-4 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-900 font-medium shadow-sm"
						>
							{isEditing ? "Guardar Cambios" : "Crear Rúbrica"}
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
