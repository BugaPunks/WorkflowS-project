import { useSession } from "@/hooks/useSession";

export default function HeaderNav() {
	const { session, loading, logout, isAuthenticated } = useSession();

	// Función para manejar el cierre de sesión
	const handleLogout = (e: React.MouseEvent) => {
		e.preventDefault();
		logout();
	};

	return (
		<div className="flex items-center space-x-4">
			{loading ? (
				// Show loading state
				<div className="w-24 h-10 bg-blue-500 rounded-md animate-pulse" />
			) : isAuthenticated ? (
				// User is logged in
				<div className="flex items-center space-x-4">
					<a href="/welcome" className="text-white hover:underline">
						{session?.name}
					</a>
					<button
						type="button"
						onClick={handleLogout}
						className="bg-red-500 text-white hover:bg-red-600 px-4 py-2 rounded-md font-medium transition-colors"
					>
						Salir
					</button>
				</div>
			) : (
				// User is not logged in
				<div className="flex items-center space-x-4">
					<a href="/login" className="text-white hover:underline">
						Iniciar Sesión
					</a>
					<a
						href="/register"
						className="hidden bg-white text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-md font-medium transition-colors"
					>
						Registrarse
					</a>
				</div>
			)}
		</div>
	);
}
