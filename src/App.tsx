import "./App.css";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { LoginForm } from "@/auth/LoginForm";
import { LoginSuccess } from "@/auth/LoginSuccess";
import { RegisterForm } from "@/auth/RegisterForm";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RequireSystemRole } from "@/components/RequireSystemRole";
import { SessionProvider } from "@/hooks/useSession";
import Calendar from "@/pages/Calendar";
import Dashboard from "@/pages/Dashboard";
import Evaluations from "@/pages/Evaluations";
import GradingView from "@/pages/GradingView";
import MyEvaluations from "@/pages/MyEvaluations";
import NotificationPreferences from "@/pages/NotificationPreferences";
import ProjectDetail from "@/pages/ProjectDetail";
import Projects from "@/pages/Projects";
import Reports from "@/pages/Reports";
import Rubrics from "@/pages/Rubrics";
import SprintDetail from "@/pages/SprintDetail";
import Sprints from "@/pages/Sprints";
import TaskDetail from "@/pages/TaskDetail";
import Tasks from "@/pages/Tasks";
import UserManagement from "@/pages/UserManagement";
import UserStories from "@/pages/UserStories";

const App = () => {
	return (
		<Router>
			<SessionProvider>
				<Routes>
					{/* Rutas de autenticación */}
					<Route path="/login" element={<LoginForm />} />
					<Route path="/register" element={<RegisterForm />} />
					<Route path="/login-success" element={<LoginSuccess />} />

					{/* Rutas protegidas con DashboardLayout */}
					<Route element={<DashboardLayout />}>
						<Route path="/" element={<Dashboard />} />
						<Route path="/projects" element={<Projects />} />
						<Route path="/projects/:id" element={<ProjectDetail />} />
						<Route path="/sprints" element={<Sprints />} />
						<Route path="/sprints/:id" element={<SprintDetail />} />
						<Route path="/tasks" element={<Tasks />} />
						<Route
							path="/projects/:projectId/tasks/:taskId"
							element={<TaskDetail />}
						/>
						<Route
							path="/projects/:projectId/tasks/:taskId/grade"
							element={<GradingView />}
						/>
						<Route
							path="/projects/:projectId/sprints/:sprintId/grade"
							element={<GradingView />}
						/>
						<Route
							path="/projects/:projectId/grade"
							element={<GradingView />}
						/>
						<Route path="/user-stories" element={<UserStories />} />
						<Route path="/rubrics" element={<Rubrics />} />
						<Route path="/user-management" element={<UserManagement />} />
						<Route
							path="/notifications/preferences"
							element={<NotificationPreferences />}
						/>

						<Route path="/my-evaluations" element={<MyEvaluations />} />

						{/* Rutas protegidas por ADMIN */}
						<Route element={<RequireSystemRole allowedRole="ADMIN" />}>
							<Route path="/evaluations" element={<Evaluations />} />
							{/* La exportación CSV exige ADMIN en la API; la vista se
						    alinea con ella para que el rol no reciba un 403. */}
							<Route path="/reports" element={<Reports />} />
						</Route>

						<Route path="/calendar" element={<Calendar />} />
					</Route>
				</Routes>
			</SessionProvider>
		</Router>
	);
};

export default App;
