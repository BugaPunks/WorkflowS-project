import { useEffect, useState } from "react";
import {
	Area,
	Bar,
	BarChart,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { projectAPI } from "@/api/client";
import { useSession } from "@/hooks/useSession";

interface Sprint {
	id: string;
	name: string;
	projectId?: string;
}

interface Project {
	id: string;
	name: string;
}

interface BurndownDataPoint {
	day: number;
	date: string;
	ideal: number;
	actual: number | null;
}

interface ContributionData {
	user: {
		id: string;
		name: string;
		email: string;
		avatar: string | null;
	};
	count: number;
}

export default function Reports() {
	const { session: user } = useSession();
	const [projects, setProjects] = useState<Project[]>([]);
	const [selectedProject, setSelectedProject] = useState<string>("");
	const [sprints, setSprints] = useState<Sprint[]>([]);
	const [selectedSprint, setSelectedSprint] = useState<string>("");

	// Metrics Data
	const [burndownData, setBurndownData] = useState<{
		totalPoints: number;
		series: BurndownDataPoint[];
	} | null>(null);
	const [contributionData, setContributionData] = useState<ContributionData[]>(
		[],
	);
	const [velocityData, setVelocityData] = useState<
		{ name: string; committed: number; completed: number }[]
	>([]);

	const [_loading, setLoading] = useState(true);

	useEffect(() => {
		const loadData = async () => {
			if (!user) return;

			try {
				// Fetch projects
				const projectsData = (await projectAPI.getAll({
					memberId: user.id,
				})) as Project[];
				setProjects(projectsData || []);

				if (projectsData && projectsData.length > 0) {
					setSelectedProject(projectsData[0].id);
				}
			} catch (error) {
				console.error(error);
			} finally {
				setLoading(false);
			}
		};
		loadData();
	}, [user]);

	// Load Sprints and Contributions when Project changes
	useEffect(() => {
		if (selectedProject) {
			// Load Sprints
			fetch("/api/sprints")
				.then((res) => res.json())
				.then((data) => {
					const projSprints = data.data.filter(
						(s: Sprint) => s.projectId === selectedProject,
					);
					setSprints(projSprints);
					if (projSprints.length > 0) {
						setSelectedSprint(projSprints[0].id);
					} else {
						setSelectedSprint("");
						setBurndownData(null);
					}
				});

			// Load Contributions
			fetch(`/api/metrics/projects/${selectedProject}/contribution`)
				.then((res) => res.json())
				.then((data) => setContributionData(data.data || []));

			// Load Velocity
			fetch(`/api/metrics/projects/${selectedProject}/velocity`)
				.then((res) => res.json())
				.then((data) => setVelocityData(data.data || []));
		}
	}, [selectedProject]);

	// Load Burndown when Sprint changes
	useEffect(() => {
		if (selectedSprint) {
			fetch(`/api/metrics/sprints/${selectedSprint}/burndown`)
				.then((res) => res.json())
				.then((data) => setBurndownData(data.data));
		}
	}, [selectedSprint]);

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<h1 className="text-3xl font-bold text-gray-900 mb-6">
				Reportes y Métricas
			</h1>

			<div className="bg-white p-6 rounded-lg shadow-md mb-8">
				<div className="flex justify-between items-center mb-4 border-b pb-2">
					<h2 className="text-xl font-semibold text-gray-800">Configuración</h2>
					{selectedProject && (
						<a
							href={`/api/metrics/export/projects/${selectedProject}`}
							target="_blank"
							rel="noopener noreferrer"
							className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
						>
							📥 Exportar Datos
						</a>
					)}
				</div>
				<div className="flex gap-4 mb-6">
					<div>
						<label
							htmlFor="project-select"
							className="block text-sm font-medium text-gray-700 mb-1"
						>
							Proyecto
						</label>
						<select
							id="project-select"
							className="border rounded-md px-3 py-2"
							value={selectedProject}
							onChange={(e) => setSelectedProject(e.target.value)}
						>
							{projects.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</div>
					<div>
						<label
							htmlFor="sprint-select"
							className="block text-sm font-medium text-gray-700 mb-1"
						>
							Sprint (Burndown)
						</label>
						<select
							id="sprint-select"
							className="border rounded-md px-3 py-2"
							value={selectedSprint}
							onChange={(e) => setSelectedSprint(e.target.value)}
							disabled={sprints.length === 0}
						>
							{sprints.length === 0 && <option value="">Sin sprints</option>}
							{sprints.map((s) => (
								<option key={s.id} value={s.id}>
									{s.name}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			{/* VELOCITY CHART */}
			<div className="bg-white p-6 rounded-lg shadow-md mb-8">
				<h2 className="text-xl font-semibold text-gray-800 mb-4">
					Velocidad del Equipo (Velocity)
				</h2>
				{velocityData.length > 0 ? (
					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={velocityData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="name" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="committed" name="Comprometido" fill="#9ca3af" />
								<Bar dataKey="completed" name="Completado" fill="#3b82f6" />
							</BarChart>
						</ResponsiveContainer>
					</div>
				) : (
					<p className="text-gray-500 py-4">No hay datos de velocidad.</p>
				)}
			</div>

			{/* BURNDOWN CHART */}
			<div className="bg-white p-6 rounded-lg shadow-md mb-8">
				{burndownData ? (
					<div>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold text-gray-800">
								Burndown Chart
							</h2>
							<div>
								<span className="text-sm text-gray-600">Puntos Totales: </span>
								<span className="font-bold">{burndownData.totalPoints}</span>
							</div>
						</div>

						<div className="h-80">
							<ResponsiveContainer width="100%" height="100%">
								<ComposedChart data={burndownData.series}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="date" />
									<YAxis />
									<Tooltip />
									<Legend />
									<Line
										type="monotone"
										dataKey="ideal"
										stroke="#9ca3af"
										name="Ideal (Restante)"
										strokeDasharray="5 5"
										strokeWidth={2}
										dot={false}
									/>
									<Area
										type="monotone"
										dataKey="actual"
										fill="#3b82f6"
										stroke="#2563eb"
										name="Real (Restante)"
										fillOpacity={0.3}
									/>
								</ComposedChart>
							</ResponsiveContainer>
						</div>
					</div>
				) : (
					<p className="text-gray-500 py-8 text-center">
						Selecciona un sprint válido para ver el Burndown Chart.
					</p>
				)}
			</div>

			{/* CONTRIBUTION METRICS */}
			<div className="bg-white p-6 rounded-lg shadow-md">
				<h2 className="text-xl font-semibold text-gray-800 mb-4">
					Contribución Individual (Tareas Completadas)
				</h2>

				{contributionData.length === 0 ? (
					<p className="text-gray-500 italic py-4">
						No hay datos de tareas completadas aún.
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Usuario
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Tareas Completadas
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Barra de Progreso
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{contributionData.map((item) => {
									const maxCount = Math.max(
										...contributionData.map((c) => c.count),
									);
									const percentage = (item.count / (maxCount || 1)) * 100;

									return (
										<tr key={item.user.id}>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="flex items-center">
													<div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-bold">
														{item.user.name.charAt(0)}
													</div>
													<div className="ml-4">
														<div className="text-sm font-medium text-gray-900">
															{item.user.name}
														</div>
														<div className="text-sm text-gray-500">
															{item.user.email}
														</div>
													</div>
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="text-sm text-gray-900 font-bold">
													{item.count}
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap w-1/2">
												<div className="w-full bg-gray-200 rounded-full h-2.5">
													<div
														className="bg-green-500 h-2.5 rounded-full"
														style={{ width: `${percentage}%` }}
													></div>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
