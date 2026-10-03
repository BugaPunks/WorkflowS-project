export const DASHBOARD_MODULES = [
	{ key: "stats", label: "Resumen y métricas" },
	{ key: "quickActions", label: "Acciones rápidas" },
	{ key: "common", label: "Herramientas comunes" },
] as const;

export type DashboardModuleKey = (typeof DASHBOARD_MODULES)[number]["key"];

interface DashboardModuleToggleProps {
	dashboardModules: string[] | null;
	onModulesChange: (modules: string[]) => void;
}

export default function DashboardModuleToggle({
	dashboardModules,
	onModulesChange,
}: DashboardModuleToggleProps) {
	// null significa "sin configurar": todos los módulos visibles
	const selected =
		dashboardModules === null
			? DASHBOARD_MODULES.map((m) => m.key)
			: dashboardModules;

	const toggle = (key: string) => {
		onModulesChange(
			selected.includes(key)
				? selected.filter((m) => m !== key)
				: [...selected, key],
		);
	};

	return (
		<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
			<h3 className="text-sm font-semibold text-gray-800 mb-3">
				Módulos del panel
			</h3>
			<div className="flex flex-wrap gap-4">
				{DASHBOARD_MODULES.map(({ key, label }) => (
					<label
						key={key}
						className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
					>
						<input
							type="checkbox"
							data-testid={`module-toggle-${key}`}
							checked={selected.includes(key)}
							onChange={() => toggle(key)}
							className="h-4 w-4 rounded border-gray-300 text-blue-600"
						/>
						{label}
					</label>
				))}
			</div>
		</div>
	);
}
