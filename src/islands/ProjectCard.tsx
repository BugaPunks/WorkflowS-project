import { type Project, ProjectStatus } from "@/models/project";

interface ProjectCardProps {
	project: Project;
	isAdmin: boolean;
	onEdit: (project: Project) => void;
	onAssign: (project: Project) => void;
	onDelete: (project: Project) => void;
}

export default function ProjectCard({
	project,
	isAdmin,
	onEdit,
	onAssign,
	onDelete,
}: ProjectCardProps) {
	// Obtener el nombre de visualización del estado del proyecto
	const getStatusDisplay = (status: ProjectStatus) => {
		switch (status) {
			case ProjectStatus.PLANNING:
				return "Planificación";
			case ProjectStatus.IN_PROGRESS:
				return "En Progreso";
			case ProjectStatus.ON_HOLD:
				return "En Pausa";
			case ProjectStatus.COMPLETED:
				return "Completado";
			case ProjectStatus.CANCELLED:
				return "Cancelado";
			default:
				return status;
		}
	};

	// Obtener la clase de color para el estado del proyecto
	const getStatusColorClass = (status: ProjectStatus) => {
		switch (status) {
			case ProjectStatus.PLANNING:
				return "bg-blue-100 text-blue-800";
			case ProjectStatus.IN_PROGRESS:
				return "bg-green-100 text-green-800";
			case ProjectStatus.ON_HOLD:
				return "bg-yellow-100 text-yellow-800";
			case ProjectStatus.COMPLETED:
				return "bg-purple-100 text-purple-800";
			case ProjectStatus.CANCELLED:
				return "bg-red-100 text-red-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	// Formatear fecha
	const formatDate = (date?: Date) => {
		if (!date) return "No definida";

		return new Date(date).toLocaleString("es-ES", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	return (
		<div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow duration-300">
			{/* Cabecera de la tarjeta */}
			<div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-50">
				<div className="flex justify-between items-start">
					<h3 className="text-lg font-semibold text-gray-800 truncate">
						{project.name}
					</h3>
					<span
						className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColorClass(project.status)}`}
					>
						{getStatusDisplay(project.status)}
					</span>
				</div>
			</div>

			{/* Cuerpo de la tarjeta */}
			<div className="p-4">
				<div className="mb-4">
					<p className="text-sm text-gray-600 line-clamp-2">
						{project.description || "Sin descripción"}
					</p>
				</div>

				<div className="grid grid-cols-2 gap-4 mb-4">
					<div>
						<p className="text-xs text-gray-500 font-medium">FECHA DE INICIO</p>
						<p className="text-sm text-gray-700">
							{formatDate(project.startDate)}
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500 font-medium">MIEMBROS</p>
						<p className="text-sm text-gray-700">
							{(project.members ?? []).length} miembros
						</p>
					</div>
				</div>

				{/* Fecha de finalización si existe */}
				{project.endDate && (
					<div className="mb-4">
						<p className="text-xs text-gray-500 font-medium">
							FECHA DE FINALIZACIÓN
						</p>
						<p className="text-sm text-gray-700">
							{formatDate(project.endDate)}
						</p>
					</div>
				)}
			</div>

			{/* Pie de la tarjeta con acciones */}
			<div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
				<a
					href={`/projects/${project.id}`}
					className="inline-flex items-center text-sm text-blue-950 hover:text-blue-800"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="h-4 w-4 mr-1"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<title>Ver detalles</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
						/>
					</svg>
					Ver detalles
				</a>

				{isAdmin && (
					<div className="flex space-x-2">
						<button
							type="button"
							onClick={() => onAssign(project)}
							className="inline-flex items-center text-sm text-green-600 hover:text-green-800"
							title="Asignar usuarios"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<title>Asignar usuarios</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
								/>
							</svg>
						</button>
						<button
							type="button"
							onClick={() => onEdit(project)}
							className="inline-flex items-center text-sm text-yellow-600 hover:text-yellow-800"
							title="Editar proyecto"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<title>Editar proyecto</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
								/>
							</svg>
						</button>
						<button
							type="button"
							onClick={() => onDelete(project)}
							className="inline-flex items-center text-sm text-red-600 hover:text-red-800"
							title="Eliminar proyecto"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<title>Eliminar proyecto</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
