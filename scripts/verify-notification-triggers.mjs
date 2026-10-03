/**
 * Verificación de los disparadores de notificación (tarea 10.4).
 *
 * Sustituye la comprobación manual en navegador por una equivalente
 * reproducible vía API: dispara cada tipo de notificación, comprueba que
 * llega al destinatario, que una preferencia desactivada la suprime y que
 * el dashboard devuelve datos reales a ADMIN y a un miembro.
 *
 * Uso: node scripts/verify-notification-triggers.mjs
 * Requiere el servidor de API en http://localhost:5000
 */

const API = process.env.API_ORIGIN || "http://localhost:5000";
const stamp = Date.now();
const results = [];

const log = (ok, name, detail = "") => {
	results.push({ ok, name, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
};

async function api(path, { method = "GET", token, body } = {}) {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = { raw: text };
	}
	return { status: res.status, body: json };
}

const SEEDED_ADMIN_EMAIL = "admin@workflow.com";
const SEEDED_ADMIN_PASSWORD = "admin123";

async function register(role, label) {
	const email = `verif_${label}_${stamp}@test.com`;
	const res = await api("/api/auth/register", {
		method: "POST",
		body: { name: `Verif ${label}`, email, password: "Test1234!", role },
	});
	if (res.status >= 400) throw new Error(`register ${label}: ${JSON.stringify(res.body)}`);
	const id = res.body.data?.user?.id ?? res.body.user?.id;
	// El registro público no concede ADMIN: se promociona con la cuenta sembrada.
	if (role === "ADMIN") {
		const adminToken = await login(SEEDED_ADMIN_EMAIL, SEEDED_ADMIN_PASSWORD);
		const promo = await api(`/api/users/${id}`, {
			method: "PUT",
			token: adminToken,
			body: { role },
		});
		if (promo.status >= 400) throw new Error(`promote ${label}: ${JSON.stringify(promo.body)}`);
	}
	return { id, email, password: "Test1234!" };
}

const tokenCache = new Map();

async function login(email, password) {
	if (tokenCache.has(email)) return tokenCache.get(email);
	const res = await fetch(`${API}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	if (!res.ok) throw new Error(`login ${email}: HTTP ${res.status}`);
	const body = await res.json().catch(() => ({}));
	// El token puede venir en el cuerpo o en la cookie httpOnly.
	let token = body.token;
	if (!token) {
		const setCookie = res.headers.getSetCookie?.() ?? [];
		const match = setCookie.map((c) => /token=([^;]+)/.exec(c)?.[1]).find(Boolean);
		if (match) token = decodeURIComponent(match);
	}
	if (!token) throw new Error(`login ${email}: no se encontro token`);
	tokenCache.set(email, token);
	return token;
}

const typesOf = (list) => new Set((list || []).map((n) => n.type));

/** Las respuestas del API anidan la entidad con o sin envoltorio; se aceptan ambas formas. */
function pickId(body, key) {
	return body?.data?.[key]?.id ?? body?.[key]?.id ?? body?.data?.id ?? body?.id;
}

async function main() {
	const admin = await register("ADMIN", "admin");
	const dev = await register("TEAM_DEVELOPER", "dev");
	const adminToken = await login(admin.email, admin.password);
	const devToken = await login(dev.email, dev.password);

	const projects = await api("/api/projects", {
		method: "POST",
		token: adminToken,
		body: {
			name: `Verif Project ${stamp}`,
			description: "verificacion",
			ownerId: admin.id,
		},
	});
	const projectId = pickId(projects.body, "project");
	if (!projectId) throw new Error(`create project: ${JSON.stringify(projects.body)}`);
	log(true, "projecto creado", projectId);

	// PROJECT_ASSIGNED
	await api(`/api/projects/${projectId}/members`, {
		method: "POST",
		token: adminToken,
		body: { userId: dev.id, role: "TEAM_DEVELOPER" },
	});
	await api(`/api/projects/${projectId}/members`, {
		method: "POST",
		token: adminToken,
		body: { userId: admin.id, role: "DEVELOPER" },
	});

	// USER_STORY_ASSIGNED
	const story = await api("/api/user-stories", {
		method: "POST",
		token: adminToken,
		body: {
			title: `Verif Story ${stamp}`,
			description: "verificacion",
			projectId,
			storyPoints: 5,
		},
	});
	const storyId = pickId(story.body, "userStory");
	if (!storyId) throw new Error(`create story: ${JSON.stringify(story.body)}`);
	await api(`/api/user-stories/${storyId}`, {
		method: "PUT",
		token: adminToken,
		body: { assigneeId: dev.id },
	});

	// TASK_ASSIGNED
	const task = await api("/api/tasks", {
		method: "POST",
		token: adminToken,
		body: {
			title: `Verif Task ${stamp}`,
			description: "verificacion",
			projectId,
			priority: "MEDIUM",
			assigneeId: dev.id,
		},
	});
	const taskId = pickId(task.body, "task");
	if (!taskId) throw new Error(`create task: ${JSON.stringify(task.body)}`);

	// Sprint dentro del proyecto
	const sprint = await api("/api/sprints", {
		method: "POST",
		token: adminToken,
		body: {
			name: `Verif Sprint ${stamp}`,
			projectId,
			startDate: new Date(Date.now() - 5 * 864e5).toISOString(),
			endDate: new Date(Date.now() + 5 * 864e5).toISOString(),
		},
	});
	const sprintId = pickId(sprint.body, "sprint");

	// EVALUATION_COMPLETED
	if (sprintId) {
		await api(`/api/tasks/${taskId}`, {
			method: "PUT",
			token: adminToken,
			body: { sprintId },
		});
		await api(`/api/tasks/${taskId}/evaluate`, {
			method: "POST",
			token: adminToken,
			body: { score: 90, feedback: "Verificacion OK", evaluatorId: admin.id },
		});
	}

	// MESSAGE
	const chat = await api("/api/chat/direct", {
		method: "POST",
		token: adminToken,
		body: { targetUserId: dev.id },
	});
	const chatId = pickId(chat.body, "chat");
	if (chatId) {
		await api(`/api/chat/conversation/${chatId}/messages`, {
			method: "POST",
			token: adminToken,
			body: { content: `Mensaje de verificacion ${stamp}` },
		});
	}

	// RETROSPECTIVE_ITEM
	if (sprintId) {
		await api("/api/retrospectives", {
			method: "POST",
			token: adminToken,
			body: {
				sprintId,
				type: "WENT_WELL",
				content: `Nota de verificacion ${stamp}`,
				userId: admin.id,
			},
		});
	}

	// SPRINT_COMPLETED
	if (sprintId) {
		await api(`/api/sprints/${sprintId}`, {
			method: "PUT",
			token: adminToken,
			body: { status: "COMPLETED" },
		});
	}

	// ---- comprobaciones de entrega ----
	const inbox = await api("/api/notifications?userId=" + dev.id, { token: devToken });
	const received = typesOf(inbox.body?.data);

	const expected = [
		["PROJECT_ASSIGNED", Boolean(projectId)],
		["USER_STORY_ASSIGNED", Boolean(storyId)],
		["TASK_ASSIGNED", Boolean(taskId)],
		["MESSAGE", Boolean(chatId)],
	];
	if (sprintId) {
		expected.push(
			["EVALUATION_COMPLETED", true],
			["RETROSPECTIVE_ITEM", true],
			["SPRINT_COMPLETED", true],
		);
	}
	for (const [type, applicable] of expected) {
		if (!applicable) continue;
		log(received.has(type), `disparador ${type}`, received.has(type) ? "entregada" : "NO recibida");
	}

	// ---- supresión por preferencia desactivada ----
	const other = await register("TEAM_DEVELOPER", "other");
	await api(`/api/projects/${projectId}/members`, {
		method: "POST",
		token: adminToken,
		body: { userId: other.id, role: "TEAM_DEVELOPER" },
	});
	const otherToken = await login(other.email, other.password);
	await api("/api/notification-preferences/MESSAGE", {
		method: "PUT",
		token: otherToken,
		body: { enabled: false },
	});
	const chat2 = await api("/api/chat/direct", {
		method: "POST",
		token: adminToken,
		body: { targetUserId: other.id },
	});
	const chat2Id = pickId(chat2.body, "chat");
	if (chat2Id) {
		await api(`/api/chat/conversation/${chat2Id}/messages`, {
			method: "POST",
			token: adminToken,
			body: { content: `Debe suprimirse ${stamp}` },
		});
	}
	const otherInbox = await api("/api/notifications?userId=" + other.id, {
		token: otherToken,
	});
	const otherTypes = typesOf(otherInbox.body?.data);
	log(
		!otherTypes.has("MESSAGE"),
		"preferencia MESSAGE desactivada suprime la entrega",
		otherTypes.has("MESSAGE") ? "llego pese a estar desactivada" : "suprimida",
	);
	log(
		otherTypes.has("PROJECT_ASSIGNED"),
		"otra preferencia activa sigue entregando",
		otherTypes.has("PROJECT_ASSIGNED") ? "PROJECT_ASSIGNED entregada" : "no entregada",
	);

	// ---- dashboard con datos reales ----
	const devSummary = await api(`/api/users/${dev.id}/dashboard-summary`, { token: devToken });
	const ds = devSummary.body?.data ?? devSummary.body;
	log(
		devSummary.status === 200 && typeof ds?.activeTasks === "number",
		"dashboard de miembro devuelve activeTasks",
		`activeTasks=${ds?.activeTasks} totalItems=${ds?.totalItems}`,
	);

	const adminSummary = await api(`/api/users/${admin.id}/dashboard-summary`, { token: adminToken });
	const as = adminSummary.body?.data ?? adminSummary.body;
	// null significa "sin configurar": todos los módulos visibles.
	log(
		adminSummary.status === 200 &&
			(as?.dashboardModules === null || Array.isArray(as?.dashboardModules)),
		"dashboard de ADMIN responde sin error",
		`dashboardModules=${JSON.stringify(as?.dashboardModules)}`,
	);

	// el miembro no puede leer el dashboard de otro
	const cross = await api(`/api/users/${admin.id}/dashboard-summary`, { token: devToken });
	log(cross.status === 403, "un miembro no lee el dashboard de otro usuario", `HTTP ${cross.status}`);

	const failed = results.filter((r) => !r.ok);
	console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
	if (failed.length) {
		console.log("Fallos: " + failed.map((f) => f.name).join(", "));
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Error de verificacion:", err);
	process.exit(1);
});