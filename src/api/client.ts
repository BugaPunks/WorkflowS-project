/**
 * Cliente API para conectar el frontend React con el servidor Express
 */

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:5000/api" : "/api";

interface RequestOptions extends RequestInit {
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
}

async function apiRequest<T = unknown>(
	endpoint: string,
	options: RequestOptions = {},
): Promise<T> {
	const url = `${API_BASE_URL}${endpoint}`;
	const token = localStorage.getItem("token");
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...(options.headers as Record<string, string>),
	};

	try {
		const response = await fetch(url, {
			...options,
			headers,
		});

		if (response.status === 401) {
			localStorage.removeItem("user");
			localStorage.removeItem("token");
			window.location.href = "/login";
			throw new Error("Sesión expirada");
		}

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: response.statusText }));
			throw new Error(error.error || `HTTP ${response.status}`);
		}

		const responseData = await response.json();

		return (
			responseData.data !== undefined ? responseData.data : responseData
		) as T;
	} catch (error) {
		console.error(`API Error [${options.method || "GET"} ${endpoint}]:`, error);
		throw error;
	}
}

// ============ USUARIOS ============

export const userAPI = {
	getAll: () => apiRequest("/users"),
	getById: (id: string) => apiRequest(`/users/${id}`),
	create: (data: {
		email: string;
		name: string;
		password: string;
		role?: string;
	}) => apiRequest("/users", { method: "POST", body: JSON.stringify(data) }),
	update: (id: string, data: unknown) =>
		apiRequest(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
	delete: (id: string) => apiRequest(`/users/${id}`, { method: "DELETE" }),
};

// ============ PROYECTOS ============

export const projectAPI = {
	getAll: (queryParams?: { memberId?: string }) => {
		const params = new URLSearchParams(queryParams as Record<string, string>);
		return apiRequest(`/projects?${params.toString()}`);
	},
	getById: (id: string) => apiRequest(`/projects/${id}`),
	create: (data: { name: string; description?: string; ownerId: string }) =>
		apiRequest("/projects", { method: "POST", body: JSON.stringify(data) }),
	update: (id: string, data: unknown) =>
		apiRequest(`/projects/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),
	delete: (id: string) => apiRequest(`/projects/${id}`, { method: "DELETE" }),
};

// ============ SPRINTS ============

export const sprintAPI = {
	getAll: () => apiRequest("/sprints"),
	getById: (id: string) => apiRequest(`/sprints/${id}`),
	create: (data: {
		name: string;
		description?: string;
		projectId: string;
		startDate?: string;
		endDate?: string;
		status?: string;
	}) => apiRequest("/sprints", { method: "POST", body: JSON.stringify(data) }),
	update: (id: string, data: unknown) =>
		apiRequest(`/sprints/${id}`, { method: "PUT", body: JSON.stringify(data) }),
	delete: (id: string) => apiRequest(`/sprints/${id}`, { method: "DELETE" }),
};

// ============ TAREAS ============

export const taskAPI = {
	getAll: (queryParams?: { assigneeId?: string; projectId?: string }) => {
		const params = new URLSearchParams(queryParams as Record<string, string>);
		return apiRequest(`/tasks?${params.toString()}`);
	},
	getById: (id: string) => apiRequest(`/tasks/${id}`),
	create: (data: {
		title: string;
		description?: string;
		projectId: string;
		assigneeId?: string;
		priority?: string;
		deadline?: string;
		status?: string;
		sprintId?: string;
		userStoryId?: string;
	}) => apiRequest("/tasks", { method: "POST", body: JSON.stringify(data) }),
	update: (id: string, data: unknown) =>
		apiRequest(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
	delete: (id: string) => apiRequest(`/tasks/${id}`, { method: "DELETE" }),
};

// ============ USER STORIES ============

export const userStoryAPI = {
	getAll: () => apiRequest("/user-stories"),
	getById: (id: string) => apiRequest(`/user-stories/${id}`),
	create: (data: {
		title: string;
		description?: string;
		projectId: string;
		assigneeId?: string;
		priority?: string;
		storyPoints?: number;
	}) =>
		apiRequest("/user-stories", { method: "POST", body: JSON.stringify(data) }),
	update: (id: string, data: unknown) =>
		apiRequest(`/user-stories/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),
	delete: (id: string) =>
		apiRequest(`/user-stories/${id}`, { method: "DELETE" }),
};

// ============ HEALTH CHECK ============

export const healthAPI = {
	check: () => apiRequest("/health"),
};
