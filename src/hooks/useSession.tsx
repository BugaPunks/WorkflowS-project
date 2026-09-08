import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { type User, UserRole } from "@/models/user";

interface SessionContextType {
	session: User | null;
	loading: boolean;
	isAuthenticated: boolean;
	login: (
		userData: Partial<User> & Pick<User, "id" | "name" | "email" | "role">,
		token: string,
	) => void;
	logout: () => void;
	permissions: string[];
	token: string | null;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [session, setSession] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [permissions, setPermissions] = useState<string[]>([]);

	useEffect(() => {
		const userData = localStorage.getItem("user");
		const storedToken = localStorage.getItem("token");
		if (userData) {
			try {
				const parsedUser = JSON.parse(userData);
				setSession(parsedUser);
			} catch (error) {
				console.error("Error al parsear los datos de sesión:", error);
			}
		}
		if (storedToken) {
			setToken(storedToken);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		if (session) {
			const newPermissions = getPermissionsByRole(session.role);
			setPermissions(newPermissions);
		} else {
			setPermissions([]);
		}
	}, [session]);

	const login = (
		userData: Partial<User> & Pick<User, "id" | "name" | "email" | "role">,
		tokenValue: string,
	) => {
		const { password: _password, ...userForStorage } = userData;
		setSession({ ...userData, password: "" } as User);
		setToken(tokenValue);
		localStorage.setItem("user", JSON.stringify(userForStorage));
		localStorage.setItem("token", tokenValue);
	};

	const logout = () => {
		setSession(null);
		setToken(null);
		setPermissions([]);
		localStorage.removeItem("user");
		localStorage.removeItem("token");
	};

	const value: SessionContextType = {
		session,
		loading,
		isAuthenticated: !!session,
		login,
		logout,
		permissions,
		token,
	};

	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
};

const getPermissionsByRole = (role: UserRole): string[] => {
	switch (role) {
		case UserRole.ADMIN:
			return [
				"create:project",
				"edit:project",
				"delete:project",
				"manage:users",
				"view:rubrics",
			];
		case UserRole.PRODUCT_OWNER:
			return [
				"create:project",
				"edit:project",
				"create:user-story",
				"create:sprint",
				"manage:team",
			];
		case UserRole.SCRUM_MASTER:
			return [
				"create:sprint",
				"manage:sprint",
				"assign:user-story",
				"create:task",
			];
		case UserRole.TEAM_DEVELOPER:
			return ["create:task", "update:task", "view:project"];
		default:
			return ["view:project"];
	}
};

export const useSession = () => {
	const context = useContext(SessionContext);
	if (!context) {
		throw new Error("useSession debe ser usado dentro de un SessionProvider");
	}
	return context;
};
