import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
}

interface ComingSoonProps {
	title: string;
	description: string;
	icon: string;
}

export default function ComingSoon({
	title,
	description,
	icon,
}: ComingSoonProps) {
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);

	useEffect(() => {
		const storedUser = localStorage.getItem("user");
		if (!storedUser) {
			navigate("/login");
			return;
		}
		setUser(JSON.parse(storedUser));
	}, [navigate]);

	return (
		<AppShell user={user || undefined}>
			<div className="flex items-center justify-center min-h-full p-8">
				<div className="text-center">
					<div className="text-8xl mb-6">{icon}</div>
					<h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
					<p className="text-gray-600 mb-8 max-w-md">{description}</p>
					<button
						type="button"
						onClick={() => navigate("/projects")}
						className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium"
					>
						Volver a Proyectos
					</button>
				</div>
			</div>
		</AppShell>
	);
}
