import type { RolePanelProps } from "../pages/Dashboard";

export default function ProductOwnerWelcomeOptions({
	activeTasks,
	totalItems,
}: RolePanelProps) {
	return (
		<div className="space-y-6">
			<div className="bg-white p-6 rounded-lg shadow-md">
				<h2
					className="text-xl font-bold mb-4 text-gray-800"
					data-testid="panel-product-owner"
				>
					Panel de Product Owner
				</h2>
				<p className="text-gray-600 mb-6">
					Como Product Owner, eres responsable de maximizar el valor del
					producto y gestionar el backlog.
				</p>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200 flex flex-col justify-center items-center">
						<span className="text-4xl font-bold text-indigo-800">
							{activeTasks}
						</span>
						<span className="text-sm font-medium text-indigo-600">
							Tareas Activas en Proyectos
						</span>
					</div>
					<div className="bg-green-50 p-5 rounded-lg border border-green-200 flex flex-col justify-center items-center">
						<span className="text-4xl font-bold text-green-800">
							{totalItems}
						</span>
						<span className="text-sm font-medium text-green-600">
							Total de Proyectos
						</span>
					</div>
				</div>
			</div>

			<div className="bg-white p-6 rounded-lg shadow-md">
				<h2 className="text-xl font-bold mb-4 text-gray-800">
					Acciones Rápidas
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
					<a
						href="/user-stories"
						className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-center transition-colors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-8 w-8 mx-auto mb-2 text-gray-700"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<title>Icono de historias de usuario</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<span className="text-sm font-medium text-gray-700">
							Historias de Usuario
						</span>
					</a>
					<a
						href="/projects"
						className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-center transition-colors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-8 w-8 mx-auto mb-2 text-gray-700"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<title>Icono de planificación</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
						<span className="text-sm font-medium text-gray-700">
							Ir a Proyectos para planificar
						</span>
					</a>
					<a
						href="/reports"
						className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-center transition-colors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-8 w-8 mx-auto mb-2 text-gray-700"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<title>Icono de reporte</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							/>
						</svg>
						<span className="text-sm font-medium text-gray-700">
							Ver Reportes
						</span>
					</a>
				</div>
			</div>
		</div>
	);
}
