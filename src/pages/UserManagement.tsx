import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import type { UserRole } from "@/models/user";

interface User {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	active: boolean;
	createdAt: string;
}

interface UserPayload {
	name: string;
	email: string;
	role: UserRole;
	active?: boolean;
	password?: string;
}

export default function UserManagement() {
	const [users, setUsers] = useState<User[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		role: "TEAM_DEVELOPER" as UserRole,
		active: true,
		password: "",
	});

	const loadUsers = useCallback(async () => {
		try {
			setIsLoading(true);
			const response = await fetch("/api/users");
			const data = await response.json();
			setUsers(data.data || []);
		} catch (error) {
			console.error("Error loading users:", error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

	const openCreateModal = () => {
		setIsEditing(false);
		setCurrentUserId(null);
		setFormData({
			name: "",
			email: "",
			role: "TEAM_DEVELOPER" as UserRole,
			active: true,
			password: "",
		});
		setShowModal(true);
	};

	const openEditModal = (user: User) => {
		setIsEditing(true);
		setCurrentUserId(user.id);
		setFormData({
			name: user.name,
			email: user.email,
			role: user.role,
			active: user.active,
			password: "", // Reset password field
		});
		setShowModal(true);
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			const url = isEditing ? `/api/users/${currentUserId}` : "/api/users";
			const method = isEditing ? "PUT" : "POST";

			const body: UserPayload = {
				name: formData.name,
				email: formData.email,
				role: formData.role,
			};

			if (isEditing) {
				body.active = formData.active;
				if (formData.password && formData.password.trim() !== "") {
					body.password = formData.password;
				}
			} else {
				// Creating
				body.password = formData.password;
			}

			const response = await fetch(url, {
				method: method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Error saving user");
			}

			setShowModal(false);
			loadUsers();
		} catch (error) {
			console.error("Error saving user:", error);
			alert(
				error instanceof Error ? error.message : "Error al guardar usuario",
			);
		}
	};

	const handleDelete = async (userId: string) => {
		if (!confirm("¿Estás seguro de que quieres eliminar este usuario?")) return;

		try {
			const response = await fetch(`/api/users/${userId}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error("Error deleting user");
			loadUsers();
		} catch (error) {
			console.error("Error deleting user:", error);
			alert("Error al eliminar el usuario");
		}
	};

	const getRoleDisplay = (role: UserRole) => {
		const roles: Record<UserRole, string> = {
			ADMIN: "Administrador",
			PRODUCT_OWNER: "Product Owner",
			SCRUM_MASTER: "Scrum Master",
			TEAM_DEVELOPER: "Team Developer",
		};
		return roles[role] || role;
	};

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">
						Gestión de Usuarios
					</h1>
					<p className="text-gray-600 mt-2">
						Administra los usuarios del sistema, sus roles y estado
					</p>
				</div>
				<button
					type="button"
					onClick={openCreateModal}
					className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
				>
					+ Nuevo Usuario
				</button>
			</div>

			{isLoading ? (
				<div className="text-center py-12">
					<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
					<p className="text-gray-600 mt-4">Cargando usuarios...</p>
				</div>
			) : (
				<div className="bg-white shadow-md rounded-lg overflow-hidden">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Nombre
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Email
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Rol
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Estado
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Fecha de Creación
								</th>
								<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Acciones
								</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{users.map((user) => (
								<tr key={user.id}>
									<td className="px-6 py-4 whitespace-nowrap">
										<div className="text-sm font-medium text-gray-900">
											{user.name}
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										<div className="text-sm text-gray-500">{user.email}</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										<span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
											{getRoleDisplay(user.role)}
										</span>
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										<span
											className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
												user.active
													? "bg-green-100 text-green-800"
													: "bg-red-100 text-red-800"
											}`}
										>
											{user.active ? "Activo" : "Inactivo"}
										</span>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{new Date(user.createdAt).toLocaleDateString()}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
										<button
											type="button"
											onClick={() => openEditModal(user)}
											className="text-indigo-600 hover:text-indigo-900 mr-4"
										>
											Editar
										</button>
										<button
											type="button"
											onClick={() => handleDelete(user.id)}
											className="text-red-600 hover:text-red-900"
										>
											Eliminar
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Create/Edit Modal */}
			<Modal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title={isEditing ? "Editar Usuario" : "Nuevo Usuario"}
			>
				<form onSubmit={handleSave} className="space-y-4">
					<div>
						<label
							htmlFor="edit-name"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Nombre
						</label>
						<input
							id="edit-name"
							type="text"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							required
						/>
					</div>
					<div>
						<label
							htmlFor="edit-email"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Email
						</label>
						<input
							id="edit-email"
							type="email"
							value={formData.email}
							onChange={(e) =>
								setFormData({ ...formData, email: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							required
							disabled={isEditing} // Disable email on edit to prevent identity change issues if desired, or keep enabled
						/>
					</div>
					<div>
						<label
							htmlFor="edit-password"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Contraseña {isEditing && "(Opcional)"}
						</label>
						<input
							id="edit-password"
							type="password"
							value={formData.password}
							onChange={(e) =>
								setFormData({ ...formData, password: e.target.value })
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={
								isEditing
									? "Dejar en blanco para mantener la actual"
									: "Mínimo 6 caracteres"
							}
							required={!isEditing}
							minLength={isEditing ? undefined : 6}
						/>
					</div>
					<div>
						<label
							htmlFor="edit-role"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Rol
						</label>
						<select
							id="edit-role"
							value={formData.role}
							onChange={(e) =>
								setFormData({
									...formData,
									role: e.target.value as UserRole,
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="ADMIN">Administrador</option>
							<option value="PRODUCT_OWNER">Product Owner</option>
							<option value="SCRUM_MASTER">Scrum Master</option>
							<option value="TEAM_DEVELOPER">Team Developer</option>
						</select>
					</div>
					{isEditing && (
						<div>
							<label className="flex items-center">
								<input
									type="checkbox"
									checked={formData.active}
									onChange={(e) =>
										setFormData({ ...formData, active: e.target.checked })
									}
									className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<span className="ml-2 text-sm text-gray-700">
									Usuario activo
								</span>
							</label>
						</div>
					)}

					<div className="flex gap-3 mt-6">
						<button
							type="button"
							onClick={() => setShowModal(false)}
							className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
						>
							Cancelar
						</button>
						<button
							type="submit"
							className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
						>
							{isEditing ? "Guardar" : "Crear"}
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
