import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

interface RetrospectiveItem {
	id: string;
	type: "GOOD" | "BAD" | "ACTION";
	content: string;
	user: {
		id: string;
		name: string;
		avatar: string | null;
	};
}

interface Props {
	sprintId: string;
}

const COLUMNS = [
	{
		id: "GOOD",
		title: "Lo que hicimos bien",
		color: "bg-green-100",
		titleColor: "text-green-800",
		icon: "🌟",
	},
	{
		id: "BAD",
		title: "Lo que debemos mejorar",
		color: "bg-red-100",
		titleColor: "text-red-800",
		icon: "🤔",
	},
	{
		id: "ACTION",
		title: "Acciones de mejora",
		color: "bg-blue-100",
		titleColor: "text-blue-800",
		icon: "🚀",
	},
];

export default function RetrospectiveBoard({ sprintId }: Props) {
	const { session: user } = useSession();
	const [items, setItems] = useState<RetrospectiveItem[]>([]);
	const [newItemContent, setNewItemContent] = useState("");
	const [activeColumn, setActiveColumn] = useState<string | null>(null);

	const loadItems = useCallback(async () => {
		try {
			const res = await fetch(`/api/retrospectives/${sprintId}`);
			const data = await res.json();
			setItems(data.data || []);
		} catch (err) {
			console.error(err);
		}
	}, [sprintId]);

	useEffect(() => {
		loadItems();
	}, [loadItems]);

	const handleAddItem = async (type: string) => {
		if (!newItemContent.trim() || !user) return;

		// Optimistic update
		const tempId = Date.now().toString();
		const newItem: RetrospectiveItem = {
			id: tempId,
			type: type as RetrospectiveItem["type"],
			content: newItemContent,
			user: { id: user.id, name: user.name, avatar: user.avatar || null },
		};

		setItems([...items, newItem]);
		setNewItemContent("");
		setActiveColumn(null);

		try {
			await fetch("/api/retrospectives", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sprintId,
					type,
					content: newItem.content,
					userId: user.id,
				}),
			});
			loadItems(); // Refresh real ID
		} catch (err) {
			console.error(err);
			setItems((prev) => prev.filter((i) => i.id !== tempId)); // Revert
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("¿Eliminar nota?")) return;
		setItems((prev) => prev.filter((i) => i.id !== id));
		try {
			await fetch(`/api/retrospectives/${id}`, { method: "DELETE" });
		} catch (err) {
			console.error(err);
			loadItems(); // Revert
		}
	};

	return (
		<div className="h-full p-4">
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
				{COLUMNS.map((col) => (
					<div
						key={col.id}
						className={`rounded-xl shadow-sm flex flex-col h-full border-2 ${col.color.replace("bg-", "border-").replace("100", "200")}`}
					>
						{/* Header */}
						<div
							className={`p-4 ${col.color} rounded-t-lg border-b border-white/50 flex justify-between items-center`}
						>
							<h3 className={`font-bold ${col.titleColor} text-lg`}>
								{col.icon} {col.title}
							</h3>
							<span className="bg-white/50 px-2 py-1 rounded text-xs font-bold text-gray-600">
								{items.filter((i) => i.type === col.id).length}
							</span>
						</div>

						{/* Items Container */}
						<div className="flex-1 p-4 bg-white/50 space-y-3 overflow-y-auto min-h-[300px]">
							{items
								.filter((i) => i.type === col.id)
								.map((item) => (
									<div
										key={item.id}
										className={`p-3 bg-white rounded shadow-sm border border-gray-100 hover:shadow-md transition-all transform hover:-translate-y-1 relative group animate-in fade-in zoom-in duration-200`}
									>
										<p className="text-gray-800 text-sm whitespace-pre-wrap">
											{item.content}
										</p>
										<div className="flex justify-between items-center mt-2 border-t pt-2">
											<span className="text-xs text-gray-500 flex items-center gap-1">
												<div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">
													{item.user.name[0]}
												</div>
												{item.user.name}
											</span>
											{user?.id === item.user.id && (
												<button
													type="button"
													onClick={() => handleDelete(item.id)}
													className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
												>
													×
												</button>
											)}
										</div>
									</div>
								))}

							{/* Add Button / Input */}
							{activeColumn === col.id ? (
								<div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
									<textarea
										className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none shadow-inner bg-yellow-50"
										placeholder="Escribe tu nota..."
										rows={3}
										value={newItemContent}
										onChange={(e) => setNewItemContent(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey) {
												e.preventDefault();
												handleAddItem(col.id);
											}
										}}
									/>
									<div className="flex gap-2 mt-2">
										<button
											type="button"
											onClick={() => handleAddItem(col.id)}
											className="bg-blue-950 text-white px-3 py-1 rounded text-xs hover:bg-blue-900 shadow-sm"
										>
											Añadir
										</button>
										<button
											type="button"
											onClick={() => {
												setActiveColumn(null);
												setNewItemContent("");
											}}
											className="text-gray-500 px-3 py-1 text-xs hover:bg-gray-100 rounded"
										>
											Cancelar
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setActiveColumn(col.id)}
									className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium mt-2 flex items-center justify-center gap-2"
								>
									+ Añadir Nota
								</button>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
