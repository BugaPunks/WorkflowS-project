import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../hooks/useSession";

export function RequireSystemRole({ allowedRole }: { allowedRole: string }) {
	const { session, loading } = useSession();

	if (loading) {
		return <div>Loading...</div>;
	}

	if (!session || session.role !== allowedRole) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
}
