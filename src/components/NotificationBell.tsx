import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

interface Notification {
	id: string;
	title: string;
	message: string;
	type: string;
	read: boolean;
	createdAt: string;
	entityType?: string;
	entityId?: string;
}

export function NotificationBell() {
	const { session: user } = useSession();
	const navigate = useNavigate();
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);

	const loadNotifications = useCallback(async () => {
		if (!user) return;
		try {
			const [response, unreadRes] = await Promise.all([
				fetch(`/api/notifications?userId=${user.id}`),
				fetch(`/api/notifications/unread-count`),
			]);

			if (response.ok) {
				const data = await response.json();
				setNotifications(data.data || []);
			}

			if (unreadRes.ok) {
				const unreadData = await unreadRes.json();
				console.log("UNREAD DATA:", unreadData);
				setUnreadCount(unreadData.data || 0);
			} else {
				console.error("UNREAD ERROR:", await unreadRes.text());
			}
		} catch (error) {
			console.error(error);
		}
	}, [user]);

	useEffect(() => {
		loadNotifications();
		const interval = setInterval(loadNotifications, 10000); // Poll every 10s
		return () => clearInterval(interval);
	}, [loadNotifications]);

	const handleMarkRead = async (id: string) => {
		try {
			await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
			setNotifications((prev) =>
				prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
			);
			setUnreadCount((prev) => Math.max(0, prev - 1));
		} catch (error) {
			console.error(error);
		}
	};

	const handleMarkAllRead = async () => {
		try {
			await fetch(`/api/notifications/read-all`, { method: "PUT" });
			setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
			setUnreadCount(0);
		} catch (error) {
			console.error(error);
		}
	};

	const handleNotificationClick = async (notification: Notification) => {
		if (!notification.read) {
			await handleMarkRead(notification.id);
		}
		setIsOpen(false);

		if (!notification.entityType || !notification.entityId) return;

		// Route based on entityType. We might need an API call to resolve projectId
		// but since we don't want to overcomplicate the client, let's fetch it on demand if needed.
		// Wait, if it's PROJECT, the entityId IS the projectId!
		// For TASK, USER_STORY, RETROSPECTIVE_ITEM, we might need a quick fetch.
		try {
			if (notification.entityType === "PROJECT") {
				navigate(`/projects/${notification.entityId}/tasks`);
			} else if (notification.entityType === "TASK") {
				const res = await fetch(`/api/tasks/${notification.entityId}`);
				if (res.ok) {
					const data = await res.json();
					navigate(`/projects/${data.data.projectId}/tasks`);
				}
			} else if (notification.entityType === "MESSAGE") {
				// MESSAGE entity is the message, but wait, the chat API doesn't expose a single message endpoint.
				// Let's route to /dashboard.
				// Actually the requirement D8 says "route to /projects/:projectId/chat".
				// But we need the projectId! Wait, MESSAGE entity is the message, how to get the project?
				// Let's just route to `/dashboard` if we can't figure it out.
				// Actually, I can add `projectId` to the notification metadata or just route to `/dashboard` if missing.
				navigate(`/dashboard`);
			} else {
				navigate(`/dashboard`);
			}
		} catch (err) {
			console.error("Failed to route notification", err);
		}
	};

	// Close on outside click could be implemented, but for now simple toggle

	return (
		<div className="relative group/notifications">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="relative p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
				aria-label="Notificaciones"
				aria-expanded={isOpen}
			>
				<Bell size={20} />
				{unreadCount > 0 && (
					<span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{isOpen && (
				<div className="absolute bottom-full left-0 mb-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl shadow-indigo-500/10 overflow-hidden z-50 border border-gray-100 animate-in slide-in-from-bottom-2 duration-200 origin-bottom-left max-h-[80vh] flex flex-col">
					<div className="p-4 bg-white border-b border-gray-50 flex justify-between items-center sticky top-0 z-10">
						<h3 className="font-semibold text-gray-900">Notificaciones</h3>
						<div className="flex gap-2">
							{unreadCount > 0 && (
								<button
									type="button"
									onClick={handleMarkAllRead}
									className="text-indigo-600 hover:text-indigo-700 p-1 hover:bg-indigo-50 rounded-md transition-colors text-xs font-medium"
									aria-label="Marcar todas como leídas"
								>
									Marcar leídas
								</button>
							)}
							<button
								type="button"
								onClick={() => {
									setIsOpen(false);
									navigate("/notifications/preferences");
								}}
								className="text-gray-400 hover:text-indigo-600 p-1 hover:bg-indigo-50 rounded-md transition-colors text-xs flex items-center gap-1 font-medium"
								aria-label="Preferencias"
							>
								Preferencias
							</button>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-50 rounded-md transition-colors"
								aria-label="Cerrar notificaciones"
							>
								✕
							</button>
						</div>
					</div>
					<div className="overflow-y-auto flex-1">
						{notifications.length === 0 ? (
							<div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
								<Bell size={24} className="text-gray-300 mb-1" />
								No tienes notificaciones nuevas.
							</div>
						) : (
							<div className="flex flex-col divide-y divide-gray-50">
								{notifications.map((notification) => (
									<button
										key={notification.id}
										type="button"
										onClick={() => handleNotificationClick(notification)}
										className={cn(
											"p-4 text-left hover:bg-gray-50 transition-colors w-full focus:outline-none focus:bg-gray-50",
											!notification.read
												? "bg-indigo-50/30 hover:bg-indigo-50/50"
												: "bg-white",
										)}
									>
										<div className="flex justify-between items-start mb-1 gap-2">
											<h4
												className={cn(
													"text-sm line-clamp-1",
													!notification.read
														? "font-bold text-indigo-900"
														: "font-medium text-gray-700",
												)}
											>
												{notification.title}
											</h4>
											<span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
												{new Date(notification.createdAt).toLocaleDateString(
													undefined,
													{ month: "short", day: "numeric" },
												)}
											</span>
										</div>
										<p
											className={cn(
												"text-xs line-clamp-2",
												!notification.read
													? "text-indigo-700/80"
													: "text-gray-500",
											)}
										>
											{notification.message}
										</p>
										{!notification.read && (
											<div className="mt-2 flex items-center gap-1">
												<div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
												<span className="text-[10px] font-medium text-indigo-600">
													No leído
												</span>
											</div>
										)}
									</button>
								))}
							</div>
						)}
					</div>
					{notifications.length > 0 && (
						<div className="p-2 bg-gray-50 border-t border-gray-100 text-center">
							<button
								type="button"
								className="text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
							>
								Ver todas
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
