import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import type { ChatMessage } from "./types";

export function ChatSection({ projectId }: { projectId: string }) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const { session: currentUser } = useSession();

	const loadMessages = useCallback(async () => {
		try {
			const response = await fetch(`/api/chat/${projectId}/messages`);
			if (response.ok) {
				const data = await response.json();
				setMessages(data.data || []);
			}
		} catch (err) {
			console.error(err);
		}
	}, [projectId]);

	useEffect(() => {
		loadMessages();
		// Simple poll
		const interval = setInterval(loadMessages, 5000);
		return () => clearInterval(interval);
	}, [loadMessages]);

	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || !currentUser) return;

		try {
			const response = await fetch(`/api/chat/${projectId}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: currentUser.id,
					content: input,
				}),
			});
			if (response.ok) {
				setInput("");
				loadMessages();
			}
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<div className="bg-white rounded-lg shadow p-4 h-96 flex flex-col">
			<h3 className="font-bold text-lg mb-4 border-b pb-2 text-gray-800">
				Chat del Equipo
			</h3>
			<div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-gray-50 rounded">
				{messages.length === 0 && (
					<p className="text-gray-400 text-sm text-center py-8">
						No hay mensajes aún. ¡Saluda a tu equipo!
					</p>
				)}
				{messages.map((m) => {
					const isMe = m.userId === currentUser?.id;
					return (
						<div
							key={m.id}
							className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
						>
							<div
								className={`max-w-[80%] rounded-lg p-3 ${isMe ? "bg-blue-950 text-white" : "bg-white border border-gray-200 text-gray-800"}`}
							>
								{!isMe && (
									<p className="text-xs font-bold mb-1 opacity-75">
										{m.user.name}
									</p>
								)}
								<p className="text-sm">{m.content}</p>
							</div>
						</div>
					);
				})}
			</div>
			<form onSubmit={handleSend} className="flex gap-2">
				<input
					type="text"
					className="flex-1 border rounded-lg px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
					placeholder="Escribe un mensaje..."
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
				<button
					type="submit"
					className="bg-blue-950 text-white px-6 py-2 rounded-lg hover:bg-blue-900 font-medium transition-colors"
				>
					Enviar
				</button>
			</form>
		</div>
	);
}
