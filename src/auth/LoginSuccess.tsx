import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
}

export function LoginSuccess() {
	const location = useLocation();
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);

	useEffect(() => {
		const state = location.state as { user?: User } | null;
		if (state?.user) {
			setUser(state.user);
		} else {
			const storedUser = localStorage.getItem("user");
			if (storedUser) {
				setUser(JSON.parse(storedUser));
			} else {
				navigate("/login");
			}
		}
	}, [location, navigate]);

	if (!user) {
		return <div className="text-center py-8">Cargando...</div>;
	}

	const getRoleDisplay = (role: string) => {
		const roles: Record<string, string> = {
			ADMIN: "Administrador",
			PRODUCT_OWNER: "Product Owner",
			SCRUM_MASTER: "Scrum Master",
			TEAM_DEVELOPER: "Desarrollador",
		};
		return roles[role] || role;
	};

	return (
		<div className="min-h-screen bg-linear-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
			<div className="bg-white shadow-2xl rounded-lg p-8 max-w-md w-full">
				{/* Icono de éxito */}
				<div className="flex justify-center mb-6">
					<div className="bg-green-100 rounded-full p-3">
						<svg
							className="w-8 h-8 text-green-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-label="Éxito"
						>
							<title>Éxito</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
				</div>

				<h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
					¡Bienvenido!
				</h1>
				<p className="text-center text-gray-600 mb-6">
					Has iniciado sesión exitosamente
				</p>

				{/* Información del usuario */}
				<div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
					<div>
						<p className="text-sm text-gray-600">Nombre</p>
						<p className="text-lg font-semibold text-gray-800">{user.name}</p>
					</div>
					<div>
						<p className="text-sm text-gray-600">Correo</p>
						<p className="text-lg font-semibold text-gray-800">{user.email}</p>
					</div>
					<div>
						<p className="text-sm text-gray-600">Rol</p>
						<p className="text-lg font-semibold text-blue-950">
							{getRoleDisplay(user.role)}
						</p>
					</div>
				</div>

				{/* Opciones */}
				<div className="space-y-3">
					<button
						type="button"
						onClick={() => navigate("/")}
						className="w-full bg-blue-950 hover:bg-blue-900 text-white font-bold py-2 px-4 rounded-lg transition"
					>
						Ir al Panel de Control
					</button>
					<button
						type="button"
						onClick={() => {
							localStorage.removeItem("user");
							navigate("/login");
						}}
						className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition"
					>
						Cerrar Sesión
					</button>
				</div>

				{/* Footer */}
				<p className="text-center text-gray-500 text-xs mt-6">
					ID de usuario: {user.id}
				</p>
			</div>
		</div>
	);
}
