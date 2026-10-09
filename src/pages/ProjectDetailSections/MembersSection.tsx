import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import type { AvailableUser, ProjectMemberDetails } from "./types";

export function MembersSection({
	projectId,
	isProjectAdmin,
}: {
	projectId: string;
	isProjectAdmin: boolean;
}) {
	const [members, setMembers] = useState<ProjectMemberDetails[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddModal, setShowAddModal] = useState(false);
	const [users, setUsers] = useState<AvailableUser[]>([]);
	const [selectedUser, setSelectedUser] = useState("");
	const [selectedRole, setSelectedRole] = useState("TEAM_DEVELOPER");

	const loadMembers = useCallback(async () => {
		try {
			// Reload project to get members
			const response = await fetch(`/api/projects/${projectId}`);
			const data = await response.json();
			setMembers(data.data.members || []);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, [projectId]);

	const loadUsers = async () => {
		try {
			const response = await fetch("/api/users");
			const data = await response.json();
			// Filter out already added members
			const memberIds = new Set(members.map((m) => m.userId));
			const userList = Array.isArray(data) ? data : data.data || [];
			const availableUsers = userList.filter(
				(u: AvailableUser) => !memberIds.has(u.id),
			);
			setUsers(availableUsers);
		} catch (err) {
			console.error(err);
		}
	};

	useEffect(() => {
		loadMembers();
	}, [loadMembers]);

	const handleAddMember = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const response = await fetch(`/api/projects/${projectId}/members`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: selectedUser, role: selectedRole }),
			});
			if (!response.ok) throw new Error("Error al añadir miembro");
			setShowAddModal(false);
			loadMembers();
		} catch (_err) {
			alert("Error al añadir miembro");
		}
	};

	const handleRemoveMember = async (userId: string) => {
		if (!confirm("¿Eliminar miembro?")) return;
		try {
			const response = await fetch(
				`/api/projects/${projectId}/members/${userId}`,
				{
					method: "DELETE",
				},
			);
			if (!response.ok) throw new Error("Error");
			loadMembers();
		} catch (_err) {
			alert("Error al eliminar miembro");
		}
	};

	return (
		<div className="bg-white rounded-lg shadow p-4">
			<div className="flex justify-between items-center mb-4 border-b pb-2">
				<h3 className="font-bold text-lg text-gray-800">Miembros del Equipo</h3>
				{isProjectAdmin && (
					<button
						type="button"
						onClick={() => {
							loadUsers();
							setShowAddModal(true);
						}}
						className="text-sm bg-blue-100 text-blue-900 hover:bg-blue-200 px-3 py-1 rounded"
					>
						+ Añadir Miembro
					</button>
				)}
			</div>

			{loading ? (
				<div className="text-center py-4">Cargando...</div>
			) : (
				<div className="space-y-3">
					{members.map((member) => (
						<div
							key={member.id}
							className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-100"
						>
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
									{member.user?.name?.charAt(0)}
								</div>
								<div>
									<p className="font-medium text-sm text-gray-900">
										{member.user?.name}
									</p>
									<p className="text-xs text-gray-500">{member.user?.email}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-700 font-medium">
									{member.role}
								</span>
								{isProjectAdmin && (
									<button
										type="button"
										onClick={() => handleRemoveMember(member.userId)}
										className="text-red-400 hover:text-red-600"
									>
										×
									</button>
								)}
							</div>
						</div>
					))}
					{members.length === 0 && (
						<p className="text-gray-500 text-sm text-center">
							No hay miembros asignados.
						</p>
					)}
				</div>
			)}

			<Modal
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				title="Añadir Miembro"
			>
				<form onSubmit={handleAddMember}>
					<div className="mb-4">
						<label
							htmlFor="user-select"
							className="block text-sm font-medium mb-1 text-gray-700"
						>
							Usuario
						</label>
						<select
							id="user-select"
							className="w-full border rounded px-3 py-2"
							value={selectedUser}
							onChange={(e) => setSelectedUser(e.target.value)}
							required
						>
							<option value="">Seleccionar usuario...</option>
							{users.map((u) => (
								<option key={u.id} value={u.id}>
									{u.name} ({u.email})
								</option>
							))}
						</select>
					</div>
					<div className="mb-6">
						<label
							htmlFor="role-select"
							className="block text-sm font-medium mb-1 text-gray-700"
						>
							Rol Scrum
						</label>
						<select
							id="role-select"
							className="w-full border rounded px-3 py-2"
							value={selectedRole}
							onChange={(e) => setSelectedRole(e.target.value)}
						>
							<option value="TEAM_DEVELOPER">Team Developer</option>
							<option value="SCRUM_MASTER">Scrum Master</option>
							<option value="PRODUCT_OWNER">Product Owner</option>
						</select>
					</div>
					<div className="flex gap-2 justify-end">
						<button
							type="button"
							onClick={() => setShowAddModal(false)}
							className="px-4 py-2 bg-gray-100 rounded text-gray-700"
						>
							Cancelar
						</button>
						<button
							type="submit"
							className="px-4 py-2 bg-blue-950 text-white rounded"
						>
							Añadir
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
