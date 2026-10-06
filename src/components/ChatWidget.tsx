import { ChevronLeft, MessageCircle, Minus, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

interface User {
	id: string;
	name: string;
	email: string;
	avatar?: string;
	role?: string;
}

interface ChatParticipant {
	userId: string;
	user: User;
}

interface Chat {
	id: string;
	type: string;
	participants: ChatParticipant[];
	messages: Message[];
}

interface Message {
	id: string;
	content: string;
	userId: string;
	createdAt: string;
	user: User;
}

export function ChatWidget() {
	const { session: user } = useSession();
	const [isOpen, setIsOpen] = useState(false);
	const [chats, setChats] = useState<Chat[]>([]);
	const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [users, setUsers] = useState<User[]>([]);
	const [view, setView] = useState<"LIST" | "CHAT" | "NEW_CHAT">("LIST");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const loadChats = useCallback(() => {
		if (!user) return;
		fetch(`/api/chat/user/${user.id}/all`)
			.then((res) => res.json())
			.then((data) => setChats(data.data || []));
	}, [user]);

	// Load chats when user is available or widget opens
	useEffect(() => {
		if (user && isOpen) {
			loadChats();
		}
	}, [user, isOpen, loadChats]);

	// Polling for messages when a chat is selected and widget is open
	useEffect(() => {
		if (selectedChat && isOpen && view === "CHAT") {
			const loadMsgs = () => {
				fetch(`/api/chat/conversation/${selectedChat.id}/messages`)
					.then((res) => res.json())
					.then((data) => setMessages(data.data || []));
			};
			loadMsgs();
			const interval = setInterval(loadMsgs, 5000); // 5s polling
			return () => clearInterval(interval);
		}
	}, [selectedChat, isOpen, view]);

	// Auto-scroll to bottom
	useEffect(() => {
		if (messages.length > 0) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]); // Removed 'view' dependency to fix lint warning, though 'view' change might need scroll

	// If we switch to CHAT view, we might want to scroll to bottom
	useEffect(() => {
		if (view === "CHAT" && messages.length > 0) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [view, messages.length]);

	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || !selectedChat || !user) return;

		try {
			await fetch(`/api/chat/conversation/${selectedChat.id}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: user.id, content: input }),
			});
			setInput("");
			// Immediate fetch
			const res = await fetch(
				`/api/chat/conversation/${selectedChat.id}/messages`,
			);
			const data = await res.json();
			setMessages(data.data || []);
		} catch (err) {
			console.error(err);
		}
	};

	const loadUsers = async () => {
		const res = await fetch("/api/users");
		const data = await res.json();
		setUsers(data.data || []);
	};

	const startDM = async (targetUserId: string) => {
		if (!user) return;
		try {
			const res = await fetch("/api/chat/direct", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: user.id, targetUserId }),
			});
			const data = await res.json();
			const chat = data.data;

			// Refresh list
			loadChats(); // Don't await void

			// Select new chat
			const listRes = await fetch(`/api/chat/user/${user.id}/all`);
			const listData = await listRes.json();
			const fullChat = (listData.data || []).find(
				(c: Chat) => c.id === chat.id,
			);

			if (fullChat) {
				setSelectedChat(fullChat);
				setView("CHAT");
			}
		} catch (err) {
			console.error(err);
		}
	};

	const getChatName = (chat: Chat) => {
		if (chat.type === "PROJECT") return "Chat de Proyecto";
		const other = chat.participants.find((p) => p.userId !== user?.id);
		return other ? other.user.name : "Chat Personal";
	};

	const getChatAvatar = (chat: Chat) => {
		if (chat.type === "PROJECT") return null;
		const other = chat.participants.find((p) => p.userId !== user?.id);
		return other?.user.name.charAt(0) || "?";
	};

	if (!user) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
			{/* Chat Window */}
			{isOpen && (
				<div className="mb-4 w-80 h-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
					{/* Header */}
					<div className="p-3 bg-blue-950 text-white flex justify-between items-center shadow-md shrink-0">
						<div className="flex items-center gap-2">
							{view === "CHAT" && (
								<button
									type="button"
									onClick={() => setView("LIST")}
									className="hover:bg-blue-900 p-1 rounded-full transition-colors"
								>
									<ChevronLeft size={20} />
								</button>
							)}
							<h3 className="font-bold text-sm truncate max-w-[150px]">
								{view === "CHAT" && selectedChat
									? getChatName(selectedChat)
									: view === "NEW_CHAT"
										? "Nuevo Mensaje"
										: "Mensajes"}
							</h3>
						</div>
						<div className="flex items-center gap-1">
							{view === "LIST" && (
								<button
									type="button"
									onClick={() => {
										setView("NEW_CHAT");
										loadUsers();
									}}
									className="hover:bg-blue-900 p-1 rounded-full transition-colors"
									title="Nuevo Chat"
								>
									<span className="text-xl leading-none font-bold">+</span>
								</button>
							)}
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className="hover:bg-blue-900 p-1 rounded-full transition-colors"
							>
								<Minus size={18} />
							</button>
						</div>
					</div>

					{/* Content */}
					<div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
						{view === "LIST" && (
							<div className="flex-1 overflow-y-auto">
								{chats.length === 0 ? (
									<div className="h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
										<MessageCircle className="w-12 h-12 mb-2 opacity-20" />
										<p className="text-sm">No tienes conversaciones.</p>
										<button
											type="button"
											onClick={() => {
												setView("NEW_CHAT");
												loadUsers();
											}}
											className="mt-2 text-blue-950 hover:underline text-sm font-medium"
										>
											Empezar una
										</button>
									</div>
								) : (
									<div className="divide-y divide-gray-100">
										{chats.map((chat) => (
											<button
												type="button"
												key={chat.id}
												onClick={() => {
													setSelectedChat(chat);
													setView("CHAT");
												}}
												className="w-full p-3 hover:bg-gray-100 transition-colors flex items-center gap-3 text-left bg-white"
											>
												<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-950 font-bold text-sm shrink-0">
													{getChatAvatar(chat) || <MessageCircle size={20} />}
												</div>
												<div className="flex-1 min-w-0">
													<div className="font-medium text-gray-900 text-sm truncate">
														{getChatName(chat)}
													</div>
													<div className="text-xs text-gray-500 truncate">
														{chat.messages[0]?.content || "Sin mensajes"}
													</div>
												</div>
											</button>
										))}
									</div>
								)}
							</div>
						)}

						{view === "NEW_CHAT" && (
							<div className="flex-1 overflow-y-auto bg-white">
								{users
									.filter((u) => u.id !== user.id)
									.map((u) => (
										<button
											type="button"
											key={u.id}
											onClick={() => startDM(u.id)}
											className="w-full p-3 hover:bg-gray-50 transition-colors flex items-center gap-3 text-left border-b border-gray-50"
										>
											<div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold">
												{u.name.charAt(0)}
											</div>
											<div>
												<div className="font-medium text-gray-900 text-sm">
													{u.name}
												</div>
												<div className="text-xs text-gray-500">{u.role}</div>
											</div>
										</button>
									))}
							</div>
						)}

						{view === "CHAT" && selectedChat && (
							<>
								<div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
									{messages.map((msg) => {
										const isMe = msg.userId === user.id;
										return (
											<div
												key={msg.id}
												className={`flex ${isMe ? "justify-end" : "justify-start"}`}
											>
												<div
													className={cn(
														"max-w-[85%] rounded-2xl px-3 py-2 shadow-sm text-sm break-words",
														isMe
															? "bg-blue-950 text-white rounded-br-none"
															: "bg-white text-gray-800 rounded-bl-none",
													)}
												>
													{!isMe && (
														<div className="text-[10px] font-bold mb-0.5 opacity-70">
															{msg.user.name}
														</div>
													)}
													<p>{msg.content}</p>
												</div>
											</div>
										);
									})}
									<div ref={messagesEndRef} />
								</div>
								<div className="p-2 bg-white border-t border-gray-200">
									<form onSubmit={handleSend} className="flex gap-2">
										<input
											type="text"
											value={input}
											onChange={(e) => setInput(e.target.value)}
											placeholder="Mensaje..."
											className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-700"
										/>
										<button
											type="submit"
											disabled={!input.trim()}
											className="bg-blue-950 text-white p-2 rounded-full hover:bg-blue-900 disabled:opacity-50 transition-colors"
										>
											<Send size={16} />
										</button>
									</form>
								</div>
							</>
						)}
					</div>
				</div>
			)}

			{/* Floating Button */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					"w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105",
					isOpen
						? "bg-gray-200 text-gray-600 rotate-90"
						: "bg-blue-950 text-white hover:bg-blue-900",
				)}
			>
				{isOpen ? <X size={24} /> : <MessageCircle size={28} />}
			</button>
		</div>
	);
}
