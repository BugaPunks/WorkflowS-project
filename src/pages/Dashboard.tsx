import { useEffect, useState } from "react";
import StudentDashboard from "@/components/dashboards/StudentDashboard";
import TeacherDashboard from "@/components/dashboards/TeacherDashboard";
import { useSession } from "@/hooks/useSession";
import { UserRole } from "@/models/user";

export interface WelcomeProps {
	activeTasks: number;
	totalItems: number;
	dashboardModules: string[] | null;
	onModulesChange: (modules: string[]) => void;
}

export interface RolePanelProps {
	activeTasks: number;
	totalItems: number;
}

export default function Dashboard() {
	const { session, loading } = useSession();
	const [summary, setSummary] = useState<WelcomeProps | null>(null);

	useEffect(() => {
		if (session && session.role !== UserRole.ADMIN) {
			fetch(`/api/users/${session.id}/dashboard-summary`)
				.then((res) => res.json())
				.then((data) => {
					setSummary({
						activeTasks: data.activeTasks,
						totalItems: data.totalItems,
						dashboardModules: data.dashboardModules,
						onModulesChange: async (modules: string[]) => {
							await fetch(`/api/users/${session.id}/dashboard`, {
								method: "PUT",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ modules }),
							});
							setSummary((prev) =>
								prev ? { ...prev, dashboardModules: modules } : null,
							);
						},
					});
				});
		}
	}, [session]);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
			</div>
		);
	}

	if (!session) return null;

	if (session.role === UserRole.ADMIN) {
		return (
			<div className="p-8 max-w-7xl mx-auto">
				<TeacherDashboard />
			</div>
		);
	}

	if (!summary) return <div>Cargando...</div>;

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<StudentDashboard {...summary} />
		</div>
	);
}
