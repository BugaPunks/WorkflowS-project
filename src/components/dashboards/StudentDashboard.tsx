import DashboardModuleToggle from "@/components/dashboards/DashboardModuleToggle";
import { useSession } from "@/hooks/useSession";
import CommonWelcomeOptions from "@/islands/CommonWelcomeOptions";
import ProductOwnerWelcomeOptions from "@/islands/ProductOwnerWelcomeOptions";
import ScrumMasterWelcomeOptions from "@/islands/ScrumMasterWelcomeOptions";
import TeamDeveloperWelcomeOptions from "@/islands/TeamDeveloperWelcomeOptions";
import WelcomeHeader from "@/islands/WelcomeHeader";
import { UserRole } from "@/models/user";
import type { WelcomeProps } from "@/pages/Dashboard";

export default function StudentDashboard({
	activeTasks,
	totalItems,
	dashboardModules,
	onModulesChange,
}: WelcomeProps) {
	const { session } = useSession();

	if (!session) return null;

	const renderRoleSpecificOptions = () => {
		const shared = { activeTasks, totalItems };
		switch (session.role) {
			case UserRole.PRODUCT_OWNER:
				return <ProductOwnerWelcomeOptions {...shared} />;
			case UserRole.SCRUM_MASTER:
				return <ScrumMasterWelcomeOptions {...shared} />;
			case UserRole.TEAM_DEVELOPER:
				return <TeamDeveloperWelcomeOptions {...shared} />;
			default:
				// Fallback for students with undefined specific role, defaults to Dev view
				return <TeamDeveloperWelcomeOptions {...shared} />;
		}
	};

	const visible = (module: string) =>
		dashboardModules === null || dashboardModules.includes(module);

	const nothingSelected =
		dashboardModules !== null && dashboardModules.length === 0;

	return (
		<div className="space-y-8 animate-in fade-in duration-500">
			<WelcomeHeader username={session.name} />

			<DashboardModuleToggle
				dashboardModules={dashboardModules}
				onModulesChange={onModulesChange}
			/>

			{nothingSelected ? (
				<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
					<h2 className="text-lg font-semibold text-gray-800 mb-2">
						No hay módulos seleccionados
					</h2>
					<p className="text-gray-600">
						Activa los módulos que quieras ver en tu panel desde las
						preferencias de arriba.
					</p>
				</div>
			) : (
				<>
					{/* Role Specific Content */}
					{visible("stats") && (
						<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
							{renderRoleSpecificOptions()}
						</div>
					)}

					{visible("quickActions") && (
						<div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
							<h3 className="text-lg font-semibold text-gray-800 mb-4">
								Acciones Rápidas
							</h3>
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
					)}

					{/* Common Tools */}
					{visible("common") && (
						<div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
							<h3 className="text-lg font-semibold text-gray-800 mb-4">
								Herramientas Comunes
							</h3>
							<CommonWelcomeOptions />
						</div>
					)}
				</>
			)}
		</div>
	);
}
