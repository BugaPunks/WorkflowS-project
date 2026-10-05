import {
	BarChart3,
	BookOpen,
	Calendar,
	CheckSquare,
	LayoutDashboard,
	LogOut,
	Rocket,
	Star,
	User,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";

interface SidebarProps {
	isOpen: boolean;
	user?: { id: string; name: string; email: string; role: string };
	onClose?: () => void;
}

export default function Sidebar({ isOpen, user, onClose }: SidebarProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const { logout } = useSession();

	const ADMIN_MENU = [
		{ label: "Proyectos", href: "/projects", icon: LayoutDashboard },
		{ label: "Sprints", href: "/sprints", icon: Rocket },
		{ label: "Rúbricas", href: "/rubrics", icon: BookOpen },
		{ label: "Historias", href: "/user-stories", icon: BookOpen },
		{ label: "Gestión de Usuarios", href: "/user-management", icon: User },
		{ label: "Reportes", href: "/reports", icon: BarChart3 },
		{ label: "Evaluaciones", href: "/evaluations", icon: Star },
		{ label: "Calendario", href: "/calendar", icon: Calendar },
	];

	const STUDENT_MENU = [
		{ label: "Proyectos", href: "/projects", icon: LayoutDashboard },
		{ label: "Sprints", href: "/sprints", icon: Rocket },
		{ label: "Tareas", href: "/tasks", icon: CheckSquare },
		{ label: "Historias", href: "/user-stories", icon: BookOpen },
		{ label: "Evaluaciones", href: "/evaluations", icon: Star },
		{ label: "Calendario", href: "/calendar", icon: Calendar },
	];

	const filteredItems = user?.role === "ADMIN" ? ADMIN_MENU : STUDENT_MENU;

	const isActive = (href: string) => {
		// Handle root path or nested paths
		if (href === "/projects" && location.pathname === "/") return true;
		return location.pathname.startsWith(href);
	};

	const handleLogout = () => {
		// Revoca la sesión en el servidor (POST /api/auth/logout incrementa
		// tokenVersion y limpia la cookie httpOnly) y luego limpia el estado local.
		logout();
		navigate("/login");
	};

	return (
		<>
			{/* Desktop Sidebar */}
			<aside
				className={cn(
					"bg-white border-r border-gray-200 flex flex-col transition-all duration-300 hidden lg:flex fixed h-full z-30",
					isOpen ? "w-64" : "w-20",
				)}
			>
				{/* Logo Area */}
				<div className="flex items-center h-16 px-6 border-b border-gray-100">
					<div className="flex items-center gap-3 text-indigo-600">
						<div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
							W
						</div>
						<span
							className={cn(
								"font-bold text-xl text-gray-900 tracking-tight",
								!isOpen && "hidden",
							)}
						>
							WorkflowS
						</span>
					</div>
				</div>

				{/* Navigation */}
				<nav className="flex-1 px-3 py-6 space-y-1">
					{filteredItems.map((item) => {
						const active = isActive(item.href);
						return (
							<Link
								key={item.href}
								to={item.href}
								className={cn(
									"flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group",
									active
										? "bg-indigo-50 text-indigo-700 font-medium"
										: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
								)}
							>
								<item.icon
									size={20}
									className={cn(
										"shrink-0 transition-colors",
										active
											? "text-indigo-600"
											: "text-gray-400 group-hover:text-gray-600",
									)}
								/>
								{isOpen && <span>{item.label}</span>}
							</Link>
						);
					})}
				</nav>

				{/* User Profile & Footer */}
				<div className="p-4 border-t border-gray-100 bg-gray-50/50">
					{isOpen ? (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">
									{user?.name?.charAt(0).toUpperCase() || <User size={18} />}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-gray-900 truncate">
										{user?.name}
									</p>
									<p className="text-xs text-gray-500 truncate capitalize">
										{user?.role?.toLowerCase()}
									</p>
								</div>
							</div>
							<div className="flex items-center justify-between gap-2 mt-1">
								<NotificationBell />
								<button
									type="button"
									onClick={handleLogout}
									className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-100"
								>
									<LogOut size={14} />
									<span>Salir</span>
								</button>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center gap-4">
							<div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
								{user?.name?.charAt(0).toUpperCase()}
							</div>
							<button
								type="button"
								onClick={handleLogout}
								className="text-gray-400 hover:text-red-600 transition-colors"
							>
								<LogOut size={20} />
								<span className="sr-only">Cerrar Sesión</span>
							</button>
						</div>
					)}
				</div>
			</aside>

			{/* Mobile Overlay & Sidebar */}
			{isOpen && (
				<div className="fixed inset-0 z-40 lg:hidden">
					<button
						type="button"
						className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm w-full h-full cursor-default transition-opacity"
						onClick={onClose}
						onKeyDown={(e) => {
							if (e.key === "Escape" && onClose) onClose();
						}}
						aria-label="Cerrar menú"
					/>
					<aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
						<div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
							<div className="flex items-center gap-3 text-indigo-600">
								<div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
									W
								</div>
								<span className="font-bold text-xl text-gray-900 tracking-tight">
									WorkflowS
								</span>
							</div>
						</div>

						<nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
							{filteredItems.map((item) => {
								const active = isActive(item.href);
								return (
									<Link
										key={item.href}
										to={item.href}
										onClick={onClose}
										className={cn(
											"flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
											active
												? "bg-indigo-50 text-indigo-700 font-medium"
												: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
										)}
									>
										<item.icon
											size={22}
											className={cn(
												active ? "text-indigo-600" : "text-gray-400",
											)}
										/>
										<span className="font-medium">{item.label}</span>
									</Link>
								);
							})}
						</nav>

						<div className="p-4 border-t border-gray-100 bg-gray-50">
							<button
								type="button"
								onClick={handleLogout}
								className="flex w-full items-center justify-center gap-2 px-4 py-3 rounded-lg text-red-600 bg-white border border-gray-200 shadow-sm hover:bg-red-50 hover:border-red-100 transition-all font-medium"
							>
								<LogOut size={18} />
								<span>Cerrar Sesión</span>
							</button>
						</div>
					</aside>
				</div>
			)}

			{/* Spacer for fixed sidebar on desktop */}
			<div
				className={cn(
					"hidden lg:block shrink-0 transition-all duration-300",
					isOpen ? "w-64" : "w-20",
				)}
			/>
		</>
	);
}
