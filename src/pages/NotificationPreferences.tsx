import {
	Bell,
	Calendar,
	CheckCircle,
	FileText,
	MessageCircle,
	Shield,
	ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Preference {
	id: string;
	userId: string;
	type: string;
	enabled: boolean;
}

const TYPE_CONFIG: Record<
	string,
	{ label: string; icon: React.FC<any>; description: string }
> = {
	TASK_ASSIGNED: {
		label: "Tareas Asignadas",
		icon: FileText,
		description: "Cuando se te asigne una nueva tarea.",
	},
	USER_STORY_ASSIGNED: {
		label: "Historias Asignadas",
		icon: FileText,
		description: "Cuando se te asigne una historia de usuario.",
	},
	EVALUATION_COMPLETED: {
		label: "Evaluaciones Completadas",
		icon: CheckCircle,
		description: "Cuando el docente evalúe una de tus tareas.",
	},
	MESSAGE: {
		label: "Mensajes Directos",
		icon: MessageCircle,
		description: "Cuando recibas un mensaje en el chat.",
	},
	PROJECT_ASSIGNED: {
		label: "Proyectos Asignados",
		icon: Shield,
		description: "Cuando te añadan a un nuevo proyecto.",
	},
	RETROSPECTIVE_ITEM: {
		label: "Notas de Retrospectiva",
		icon: ShieldAlert,
		description: "Cuando alguien añada una nota a un sprint.",
	},
	SPRINT_COMPLETED: {
		label: "Sprint Completado",
		icon: Calendar,
		description: "Cuando finalice un sprint.",
	},
};

const TYPES = Object.keys(TYPE_CONFIG);

export default function NotificationPreferences() {
	const [preferences, setPreferences] = useState<Record<string, boolean>>({});
	const [loading, setLoading] = useState(true);

	const fetchPreferences = useCallback(async () => {
		try {
			const res = await fetch("/api/notification-preferences");
			if (res.ok) {
				const data = await res.json();
				const prefMap: Record<string, boolean> = {};
				data.data.forEach((p: Preference) => {
					prefMap[p.type] = p.enabled;
				});
				setPreferences(prefMap);
			}
		} catch (error) {
			console.error("Failed to load preferences", error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchPreferences();
	}, [fetchPreferences]);

	const togglePreference = async (type: string, current: boolean) => {
		const newValue = !current;
		setPreferences((prev) => ({ ...prev, [type]: newValue }));

		try {
			const res = await fetch(`/api/notification-preferences/${type}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: newValue }),
			});

			if (!res.ok) {
				throw new Error("Failed to update");
			}
		} catch (error) {
			console.error("Failed to update preference", error);
			setPreferences((prev) => ({ ...prev, [type]: current }));
		}
	};

	return (
		<div className="p-6 max-w-4xl mx-auto">
			<div className="mb-8">
				<h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
					<Bell className="text-blue-950" />
					Preferencias de Notificaciones
				</h1>
				<p className="text-gray-600 mt-2">
					Controla qué notificaciones deseas recibir en la aplicación.
				</p>
			</div>

			{loading ? (
				<div className="flex justify-center p-12">
					<div className="w-8 h-8 border-4 border-blue-950 border-t-transparent rounded-full animate-spin"></div>
				</div>
			) : (
				<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
					{TYPES.map((type) => {
						const config = TYPE_CONFIG[type];
						const isEnabled = preferences[type] ?? true;
						const Icon = config.icon;

						return (
							<div
								key={type}
								className="p-4 sm:p-6 flex items-start sm:items-center justify-between gap-4"
							>
								<div className="flex items-start gap-4">
									<div
										className={`p-2 rounded-lg ${isEnabled ? "bg-blue-50 text-blue-950" : "bg-gray-50 text-gray-400"}`}
									>
										<Icon size={20} />
									</div>
									<div>
										<h3 className="font-medium text-gray-900">
											{config.label}
										</h3>
										<p className="text-sm text-gray-500 mt-1">
											{config.description}
										</p>
									</div>
								</div>

								<button
									type="button"
									role="switch"
									aria-checked={isEnabled}
									onClick={() => togglePreference(type, isEnabled)}
									className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-950 focus:ring-offset-2 ${
										isEnabled ? "bg-blue-950" : "bg-gray-200"
									}`}
								>
									<span
										className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
											isEnabled ? "translate-x-5" : "translate-x-0"
										}`}
									/>
								</button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
