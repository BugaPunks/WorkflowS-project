import type { RolePanelProps } from "../pages/Dashboard";

export default function ScrumMasterWelcomeOptions({
	activeTasks,
	totalItems,
}: RolePanelProps) {
	return (
		<div className="space-y-6">
			<div className="bg-white p-6 rounded-lg shadow-md">
				<h2
					className="text-xl font-bold mb-4 text-gray-800"
					data-testid="panel-scrum-master"
				>
					Panel de Scrum Master
				</h2>
				<p className="text-gray-600 mb-6">
					Como Scrum Master, eres responsable de facilitar el proceso Scrum y
					ayudar al equipo a mejorar continuamente.
				</p>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="bg-blue-50 p-5 rounded-lg border border-blue-200 flex flex-col justify-center items-center">
						<span className="text-4xl font-bold text-blue-800">
							{activeTasks}
						</span>
						<span className="text-sm font-medium text-blue-950">
							Tareas Activas en Proyectos
						</span>
					</div>
					<div className="bg-purple-50 p-5 rounded-lg border border-purple-200 flex flex-col justify-center items-center">
						<span className="text-4xl font-bold text-purple-800">
							{totalItems}
						</span>
						<span className="text-sm font-medium text-purple-600">
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
						href="/sprints"
						className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-center transition-colors flex flex-col items-center justify-center"
					>
						<span className="text-sm font-medium text-gray-700">
							Gestionar Sprints
						</span>
					</a>
				</div>
			</div>
		</div>
	);
}
