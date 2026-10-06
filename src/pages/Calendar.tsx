import {
	addDays,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

interface Sprint {
	id: string;
	name: string;
	startDate: string;
	endDate: string;
	projectId: string;
	project: {
		name: string;
	};
}

interface Task {
	id: string;
	title: string;
	deadline: string;
	projectId: string;
	project: {
		name: string;
	};
	status: string;
}

export default function Calendar() {
	const { session: user } = useSession();
	const [currentDate, setCurrentDate] = useState(new Date());
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) return;
		const loadData = async () => {
			try {
				setLoading(true);
				// Fetch Sprints
				const sprintsRes = await fetch("/api/sprints");
				const sprintsData = await sprintsRes.json();
				const sprintsList = sprintsData.data || [];
				setSprints(sprintsList);

				// Fetch Tasks
				const tasksRes = await fetch("/api/tasks");
				const tasksData = await tasksRes.json();
				// Filter tasks with deadline
				const allTasks = tasksData.data || tasksData || [];
				const tasksWithDeadline = allTasks.filter((t: Task) => t.deadline);
				setTasks(tasksWithDeadline);
			} catch (error) {
				console.error("Error loading calendar data", error);
			} finally {
				setLoading(false);
			}
		};
		loadData();
	}, [user]);

	const nextMonth = () => {
		setCurrentDate(addDays(endOfMonth(currentDate), 1));
	};

	const prevMonth = () => {
		setCurrentDate(addDays(startOfMonth(currentDate), -1));
	};

	const monthStart = startOfMonth(currentDate);
	const monthEnd = endOfMonth(monthStart);
	const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunes
	const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

	const calendarDays = eachDayOfInterval({
		start: startDate,
		end: endDate,
	});

	const getEventsForDay = (date: Date) => {
		const dateStr = format(date, "yyyy-MM-dd");

		const daySprints = sprints.filter((s) => {
			// Compare date strings to avoid timezone shifts
			const startStr = s.startDate.split("T")[0];
			const endStr = s.endDate.split("T")[0];
			return (
				dateStr === startStr ||
				dateStr === endStr ||
				(dateStr > startStr && dateStr < endStr)
			);
		});

		const dayTasks = tasks.filter((t) => {
			const deadlineStr = t.deadline.split("T")[0];
			return dateStr === deadlineStr;
		});

		return { sprints: daySprints, tasks: dayTasks };
	};

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<div className="flex items-center justify-between mb-8">
				<h1 className="text-3xl font-bold text-gray-900">Calendario</h1>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={prevMonth}
						className="p-2 hover:bg-gray-100 rounded-full"
					>
						←
					</button>
					<h2 className="text-xl font-semibold capitalize">
						{format(currentDate, "MMMM yyyy", { locale: es })}
					</h2>
					<button
						type="button"
						onClick={nextMonth}
						className="p-2 hover:bg-gray-100 rounded-full"
					>
						→
					</button>
				</div>
			</div>

			{loading ? (
				<div className="text-center py-12">Cargando...</div>
			) : (
				<div className="bg-white rounded-lg shadow border border-gray-200">
					{/* Header Days */}
					<div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
						{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
							<div
								key={day}
								className="py-3 text-center text-sm font-semibold text-gray-600"
							>
								{day}
							</div>
						))}
					</div>

					{/* Days Grid */}
					<div className="grid grid-cols-7 auto-rows-fr">
						{calendarDays.map((day) => {
							const { sprints: daySprints, tasks: dayTasks } =
								getEventsForDay(day);
							const isCurrentMonth = isSameMonth(day, monthStart);
							const isToday = isSameDay(day, new Date());

							return (
								<div
									key={day.toString()}
									className={`min-h-[120px] p-2 border-b border-r border-gray-100 ${
										!isCurrentMonth ? "bg-gray-50/50 text-gray-400" : ""
									} ${isToday ? "bg-blue-50" : ""}`}
								>
									<div className="flex justify-between items-start">
										<span
											className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
												isToday ? "bg-blue-950 text-white" : "text-gray-700"
											}`}
										>
											{format(day, "d")}
										</span>
									</div>

									<div className="mt-2 space-y-1 overflow-y-auto max-h-[80px]">
										{daySprints.map((s) => (
											<div
												key={s.id}
												className="text-xs p-1 bg-green-100 text-green-800 rounded truncate"
												title={`Sprint: ${s.name} (${s.project?.name || "Proyecto"})`}
											>
												🏃 {s.name}
											</div>
										))}
										{dayTasks.map((t) => (
											<div
												key={t.id}
												className="text-xs p-1 bg-yellow-100 text-yellow-800 rounded truncate"
												title={`Entrega: ${t.title} (${t.project?.name})`}
											>
												📌 {t.title}
											</div>
										))}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
