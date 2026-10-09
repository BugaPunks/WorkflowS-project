/**
 * Carga de datos de prueba para recorrer el flujo completo en el frontend.
 *
 * Sobre un proyecto existente (por defecto "Proyecto Sistema gestion de
 * canchas") deja listo:
 *   - Miembros del proyecto con rol (PO, Scrum Master y dos Devs).
 *   - Una rúbrica de evaluación con criterios.
 *   - Dos Sprints dentro del rango de fechas del proyecto.
 *   - Historias de usuario (backlog) asignadas a cada Sprint.
 *   - Tareas por historia, asignadas a los miembros y con estados variados
 *     (Pendiente / En Progreso / Completada) para el tablero Kanban.
 *
 * Cada sprint reparte tareas entre los cuatro roles del equipo (Product
 * Owner, Scrum Master y ambos Devs) para que todos tengan trabajo asignado.
 *
 * Usa la propia API (mismo camino que la UI), por lo que dispara las
 * notificaciones reales.
 *
 * Uso:
 *   node scripts/seed-flujo-prueba.mjs
 *   PROJECT_ID=<id> node scripts/seed-flujo-prueba.mjs
 *   PROJECT_NAME="Otro proyecto" node scripts/seed-flujo-prueba.mjs
 *
 * Requiere el servidor de API en http://localhost:5000 y los usuarios
 * sembrados por prisma/seed.ts. Es idempotente: si un registro ya existe
 * (mismo nombre/título), lo reutiliza en lugar de duplicarlo.
 */

const API = process.env.API_ORIGIN || "http://localhost:5000";

const ADMIN = { email: "admin@workflow.com", password: "admin123" };
const PROJECT_ID_ENV = process.env.PROJECT_ID || "";
const PROJECT_NAME_ENV =
	process.env.PROJECT_NAME || "Proyecto Sistema gestion de canchas";

// email -> rol de proyecto
const MEMBERS = [
	{ email: "po@workflow.com", role: "PRODUCT_OWNER" },
	{ email: "sm@workflow.com", role: "SCRUM_MASTER" },
	{ email: "dev1@workflow.com", role: "TEAM_DEVELOPER" },
	{ email: "dev2@workflow.com", role: "TEAM_DEVELOPER" },
];

const RUBRIC = {
	name: "Rúbrica Demo - Gestión de Canchas",
	description: "Evaluación del sprint de reservas y horarios",
	criteria: [
		{ name: "Funcionalidad", maxScore: 40, weight: 4 },
		{ name: "Calidad de código", maxScore: 30, weight: 3 },
		{ name: "Documentación", maxScore: 30, weight: 3 },
	],
};

/**
 * Plan de sprints. Dentro de cada sprint, `tasks[].story` es el índice de la
 * historia en `stories` a la que pertenece la tarea.
 */
const SPRINT_PLANS = [
	{
		sprint: {
			name: "Sprint 1 - Reservas y Horarios",
			description:
				"Reserva de canchas en línea y gestión de horarios disponibles",
			startDate: "2026-10-09",
			endDate: "2026-10-23",
			status: "PLANNING",
		},
		stories: [
			{
				title: "Reserva de canchas en línea",
				description:
					"Como cliente quiero reservar una cancha en línea para asegurar mi horario.",
				acceptance:
					"El sistema muestra disponibilidad, permite elegir fecha/hora y confirma la reserva.",
				priority: "HIGH",
				storyPoints: 8,
				assigneeEmail: "dev1@workflow.com",
			},
			{
				title: "Gestión de horarios disponibles",
				description:
					"Como administrador quiero gestionar los horarios de las canchas para evitar choques.",
				acceptance:
					"Se pueden crear, editar y bloquear horarios por cancha y fecha.",
				priority: "HIGH",
				storyPoints: 5,
				assigneeEmail: "dev2@workflow.com",
			},
			{
				title: "Pago de reservas",
				description:
					"Como cliente quiero pagar en línea mi reserva y recibir un comprobante.",
				acceptance:
					"Integración con pasarela de pago y comprobante descargable.",
				priority: "MEDIUM",
				storyPoints: 13,
				assigneeEmail: "dev1@workflow.com",
			},
		],
		tasks: [
			{
				story: 0,
				title: "Diseñar modelo de datos de canchas",
				assigneeEmail: "dev1@workflow.com",
				status: "COMPLETED",
				priority: "HIGH",
			},
			{
				story: 0,
				title: "API de disponibilidad de horarios",
				assigneeEmail: "dev2@workflow.com",
				status: "IN_PROGRESS",
				priority: "HIGH",
			},
			{
				story: 0,
				title: "Formulario de reserva (frontend)",
				assigneeEmail: "dev1@workflow.com",
				status: "TODO",
				priority: "MEDIUM",
			},
			{
				story: 1,
				title: "CRUD de canchas para administrador",
				assigneeEmail: "dev2@workflow.com",
				status: "TODO",
				priority: "MEDIUM",
			},
			{
				story: 1,
				title: "Vista de calendario de horarios",
				assigneeEmail: "dev1@workflow.com",
				status: "IN_PROGRESS",
				priority: "LOW",
			},
			{
				story: 2,
				title: "Integración con pasarela de pago",
				assigneeEmail: "dev2@workflow.com",
				status: "TODO",
				priority: "HIGH",
			},
		],
	},
	{
		sprint: {
			name: "Sprint 2 - Gestión y Reportes",
			description:
				"Administración de canchas, reportes de uso y notificaciones",
			startDate: "2026-10-24",
			endDate: "2026-11-06",
			status: "PLANNING",
		},
		stories: [
			{
				title: "Administración de canchas",
				description:
					"Como administrador quiero crear y editar canchas con sus características.",
				acceptance:
					"Se pueden registrar canchas con tipo, precio y estado de disponibilidad.",
				priority: "HIGH",
				storyPoints: 8,
				assigneeEmail: "dev2@workflow.com",
			},
			{
				title: "Reportes de uso de canchas",
				description:
					"Como administrador quiero ver reportes de ocupación para tomar decisiones.",
				acceptance:
					"El panel muestra ocupación por cancha y por rango de fechas.",
				priority: "MEDIUM",
				storyPoints: 5,
				assigneeEmail: "dev1@workflow.com",
			},
			{
				title: "Notificaciones de reservas",
				description:
					"Como cliente quiero recibir avisos de confirmación y recordatorio de mi reserva.",
				acceptance:
					"Se envían avisos de confirmación, recordatorio y cancelación.",
				priority: "MEDIUM",
				storyPoints: 5,
				assigneeEmail: "sm@workflow.com",
			},
			{
				title: "Refinamiento del backlog",
				description:
					"Como Product Owner quiero refinar y priorizar las historias pendientes.",
				acceptance:
					"El backlog queda priorizado con criterios de aceptación claros.",
				priority: "LOW",
				storyPoints: 3,
				assigneeEmail: "po@workflow.com",
			},
		],
		tasks: [
			{
				story: 0,
				title: "CRUD de canchas (crear/editar)",
				assigneeEmail: "dev2@workflow.com",
				status: "TODO",
				priority: "HIGH",
			},
			{
				story: 1,
				title: "Métricas de ocupación por cancha",
				assigneeEmail: "dev1@workflow.com",
				status: "IN_PROGRESS",
				priority: "MEDIUM",
			},
			{
				story: 2,
				title: "Definir plantillas de notificación",
				assigneeEmail: "sm@workflow.com",
				status: "TODO",
				priority: "MEDIUM",
			},
			{
				story: 2,
				title: "Email de confirmación de reserva",
				assigneeEmail: "sm@workflow.com",
				status: "IN_PROGRESS",
				priority: "HIGH",
			},
			{
				story: 3,
				title: "Refinar criterios de aceptación",
				assigneeEmail: "po@workflow.com",
				status: "TODO",
				priority: "LOW",
			},
		],
	},
];

const extractToken = (res) => {
	const cookies = res.headers.getSetCookie?.() ?? [];
	const cookie = cookies.find((c) => c.startsWith("token="));
	return cookie ? cookie.split(";")[0].slice("token=".length) : null;
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
	if (!res.ok) {
		throw new Error(`${method} ${path} -> ${res.status} ${text}`);
	}
	return json;
}

const unwrap = (json) => (json && json.data !== undefined ? json.data : json);

async function login(email, password) {
	const res = await fetch(`${API}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	if (!res.ok) {
		throw new Error(`Login ${email} falló: ${res.status}`);
	}
	const token = extractToken(res);
	if (!token) throw new Error("El login no devolvió cookie de sesión");
	const body = await res.json();
	return { token, user: body.user };
}

async function main() {
	console.log(`\n🌱 Cargando flujo de prueba en ${API}\n`);

	const { token: adminToken } = await login(ADMIN.email, ADMIN.password);
	console.log(`✔ Sesión de ADMIN iniciada (${ADMIN.email})`);

	// --- Proyecto ---
	const projects = unwrap(await api("/api/projects", { token: adminToken }));
	const project = PROJECT_ID_ENV
		? projects.find((p) => p.id === PROJECT_ID_ENV)
		: projects.find((p) => p.name === PROJECT_NAME_ENV);

	if (!project) {
		throw new Error(
			`No se encontró el proyecto (ID: ${PROJECT_ID_ENV || "-"}, nombre: "${PROJECT_NAME_ENV}").`,
		);
	}
	console.log(`✔ Proyecto: "${project.name}" (${project.id})`);

	// --- Usuarios ---
	const users = unwrap(await api("/api/users", { token: adminToken }));
	const userByEmail = new Map(users.map((u) => [u.email, u]));
	const userOf = (email) => {
		const user = userByEmail.get(email);
		if (!user) throw new Error(`Usuario no encontrado: ${email}`);
		return user;
	};

	// --- Miembros del proyecto ---
	const memberByUserId = new Map(project.members.map((m) => [m.userId, m]));
	for (const { email, role } of MEMBERS) {
		const user = userOf(email);
		const existing = memberByUserId.get(user.id);
		if (existing && existing.role === role) {
			console.log(`✔ Miembro ya presente: ${user.name} (${role})`);
			continue;
		}
		await api(`/api/projects/${project.id}/members`, {
			method: "POST",
			token: adminToken,
			body: { userId: user.id, role },
		});
		console.log(
			`✔ Miembro ${existing ? "actualizado" : "añadido"}: ${user.name} (${role})`,
		);
	}

	// --- Rúbrica ---
	const rubrics = unwrap(
		await api(`/api/rubrics?projectId=${project.id}`, { token: adminToken }),
	);
	if (rubrics.some((r) => r.name === RUBRIC.name)) {
		console.log(`✔ Rúbrica ya existe: ${RUBRIC.name}`);
	} else {
		await api("/api/rubrics", {
			method: "POST",
			token: adminToken,
			body: { projectId: project.id, ...RUBRIC },
		});
		console.log(`✔ Rúbrica creada: ${RUBRIC.name}`);
	}

	// --- Sprints, historias y tareas ---
	const allSprints = unwrap(await api("/api/sprints", { token: adminToken }));
	const allStories = unwrap(
		await api("/api/user-stories", { token: adminToken }),
	);
	const storyByTitle = new Map(allStories.map((s) => [s.title, s]));

	const taskCount = { created: 0, existing: 0 };
	const summary = [];

	for (const plan of SPRINT_PLANS) {
		console.log(`\n── ${plan.sprint.name} ──`);

		let sprint = allSprints.find(
			(s) => s.projectId === project.id && s.name === plan.sprint.name,
		);
		if (sprint) {
			console.log(`✔ Sprint ya existe: ${sprint.name}`);
		} else {
			sprint = unwrap(
				await api("/api/sprints", {
					method: "POST",
					token: adminToken,
					body: { projectId: project.id, ...plan.sprint },
				}),
			);
			console.log(`✔ Sprint creado: ${sprint.name}`);
		}

		const sprintStories = storyByTitle;
		const createdStories = [];

		for (const storyDef of plan.stories) {
			let story = sprintStories.get(storyDef.title);
			const { assigneeEmail, ...payload } = storyDef;
			if (!story) {
				story = unwrap(
					await api("/api/user-stories", {
						method: "POST",
						token: adminToken,
						body: {
							...payload,
							projectId: project.id,
							assigneeId: userOf(assigneeEmail).id,
						},
					}),
				);
				storyByTitle.set(story.title, story);
				console.log(`✔ Historia creada: ${story.title}`);
			} else {
				console.log(`✔ Historia ya existe: ${story.title}`);
			}

			if (story.sprintId !== sprint.id) {
				await api(`/api/sprints/${sprint.id}/add-story`, {
					method: "POST",
					token: adminToken,
					body: { userStoryId: story.id },
				});
				console.log(`   ↳ asignada al ${sprint.name}`);
			}
			createdStories.push(story);
		}

		const projectTasks = unwrap(
			await api(`/api/tasks?projectId=${project.id}`, { token: adminToken }),
		);
		const taskByTitle = new Map(projectTasks.map((t) => [t.title, t]));

		for (const taskDef of plan.tasks) {
			const { story, assigneeEmail, ...payload } = taskDef;
			if (taskByTitle.has(taskDef.title)) {
				console.log(`✔ Tarea ya existe: ${taskDef.title}`);
				taskCount.existing += 1;
				continue;
			}
			await api("/api/tasks", {
				method: "POST",
				token: adminToken,
				body: {
					...payload,
					projectId: project.id,
					sprintId: sprint.id,
					userStoryId: createdStories[story].id,
					assigneeId: userOf(assigneeEmail).id,
				},
			});
			console.log(`✔ Tarea creada: ${taskDef.title} [${payload.status}]`);
			taskCount.created += 1;
		}

		summary.push({
			name: plan.sprint.name,
			stories: plan.stories.length,
			tasks: plan.tasks.length,
			range: `${plan.sprint.startDate} → ${plan.sprint.endDate}`,
		});
	}

	console.log(`
✅ Flujo de prueba listo.

Resumen:
  Proyecto : ${project.name}
${summary.map((s) => `  ${s.name}: ${s.stories} historias, ${s.tasks} tareas (${s.range})`).join("\n")}
  Tareas   : ${taskCount.created} creadas, ${taskCount.existing} ya existían
  Miembros : ${MEMBERS.map((m) => `${m.email} (${m.role})`).join(", ")}

Credenciales para probar el frontend (http://localhost:3000):
  Docente/Admin : admin@workflow.com  / admin123
  Product Owner : po@workflow.com     / password123
  Scrum Master  : sm@workflow.com     / password123
  Dev 1         : dev1@workflow.com   / password123
  Dev 2         : dev2@workflow.com   / password123
`);
}

main().catch((error) => {
	console.error(`\n✖ ${error.message}\n`);
	process.exit(1);
});
