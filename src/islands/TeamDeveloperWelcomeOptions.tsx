import type { RolePanelProps } from "../pages/Dashboard";

export default function TeamDeveloperWelcomeOptions({
	activeTasks,
	totalItems,
}: RolePanelProps) {
	return (
		<div className="space-y-6">
			<div className="bg-white p-6 rounded-lg shadow-md">
				<h2
					className="text-xl font-bold mb-4 text-gray-800"
					data-testid="panel-desarrollador"
				>
					Panel de Desarrollador
				</h2>
				<p className="text-gray-600 mb-6">
					Como miembro del equipo de desarrollo, eres responsable de entregar
					incrementos de producto de alta calidad en cada sprint.
				</p>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="bg-blue-50 p-5 rounded-lg border border-blue-200 flex flex-col justify-center items-center">
						<span
							className="text-4xl font-bold text-blue-800"
							data-testid="active-tasks"
						>
							{activeTasks}
						</span>
						<span className="text-sm font-medium text-blue-600">
							Tareas Activas
						</span>
					</div>
					<div className="bg-green-50 p-5 rounded-lg border border-green-200 flex flex-col justify-center items-center">
						<span
							className="text-4xl font-bold text-green-800"
							data-testid="total-items"
						>
							{totalItems}
						</span>
						<span className="text-sm font-medium text-green-600">
							Total de Tareas
						</span>
					</div>
				</div>
			</div>

			<div className="bg-white p-6 rounded-lg shadow-md">
				<h2 className="text-xl font-bold mb-4 text-gray-800">
					Acciones Rápidas
				</h2>
				<div className="grid grid-cols-2 gap-4">
					<a
						href="/tasks?filter=pending"
						className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-center transition-colors flex flex-col items-center justify-center"
					>
						<span className="text-sm font-medium text-gray-700">
							Tareas Pendientes
						</span>
					</a>
					<a
						href="/tasks"
						className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-center transition-colors flex flex-col items-center justify-center"
					>
						<span className="text-sm font-medium text-gray-700">
							Todas mis tareas
						</span>
					</a>
				</div>
			</div>
		</div>
	);
}
