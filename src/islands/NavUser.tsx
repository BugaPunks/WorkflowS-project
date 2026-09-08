import type React from "react";
import {
	SidebarGroup,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "../components/ui/sidebar";
import { useSession } from "../hooks/useSession";

export default function NavUser(): React.ReactElement {
	const { session, loading, logout, isAuthenticated } = useSession();

	// Función para manejar el cierre de sesión
	const handleLogout = (e: React.MouseEvent) => {
		e.preventDefault();
		logout();
	};

	if (loading) {
		return (
			<SidebarGroup className="px-2 py-0">
				<SidebarMenu>
					<SidebarMenuItem>
						<div className="h-8 bg-gray-200 rounded-md animate-pulse" />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroup>
		);
	}

	if (!isAuthenticated) {
		return (
			<SidebarGroup className="px-2 py-0">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton>
							<a href="/login" className="flex items-center w-full">
								<span>Iniciar Sesión</span>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroup>
		);
	}

	return (
		<SidebarGroup className="px-2 py-0">
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton>
						<div className="flex items-center w-full">
							<div className="bg-blue-600 text-white flex aspect-square size-6 items-center justify-center rounded-full mr-2">
								<span className="text-xs">
									{session?.name?.charAt(0).toUpperCase()}
								</span>
							</div>
							<span>{session?.name}</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
				<SidebarMenuItem>
					<SidebarMenuButton>
						<button
							type="button"
							onClick={handleLogout}
							className="flex items-center w-full text-red-500"
						>
							<span>Cerrar Sesión</span>
						</button>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarGroup>
	);
}
