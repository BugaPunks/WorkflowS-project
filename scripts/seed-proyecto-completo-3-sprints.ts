import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

let adapter;
if (connectionString?.startsWith("postgresql")) {
	adapter = new PrismaPg(new Pool({ connectionString }));
} else if (connectionString?.startsWith("file:")) {
	adapter = new PrismaBetterSqlite3({ url: connectionString });
}

const prisma = new PrismaClient({
	log: ["error", "warn"],
	...(adapter && { adapter }),
});

// ---------------------------------------------------------------------------
// Configuración (sobrescribible por variables de entorno)
// ---------------------------------------------------------------------------
const PROJECT_NAME =
	process.env.PROJECT_NAME || "Sistema de Reservas y Administración de Canchas Deportivas";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@workflow.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// 3 integrantes NUEVOS del grupo (distintos a los usuarios ya existentes).
const INTEGRANTES = [
	{
		email: process.env.SM_EMAIL || "maria.lopez@workflow.com",
		name: process.env.SM_NAME || "María López",
		role: "SCRUM_MASTER" as const,
	},
	{
		email: process.env.PO_EMAIL || "juan.perez@workflow.com",
		name: process.env.PO_NAME || "Juan Pérez",
		role: "PRODUCT_OWNER" as const,
	},
	{
		email: process.env.DEV_EMAIL || "lucia.gomez@workflow.com",
		name: process.env.DEV_NAME || "Lucía Gómez",
		role: "TEAM_DEVELOPER" as const,
	},
];

// ---------------------------------------------------------------------------
// Fechas: todo el proyecto y sus sprints quedan en el MES ANTERIOR al actual.
// ---------------------------------------------------------------------------
function previousMonthRange() {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const end = new Date(now.getFullYear(), now.getMonth(), 0);
	return { start, end };
}

function splitIntoThree(start: Date, end: Date) {
	const totalMs = end.getTime() - start.getTime();
	const third = Math.floor(totalMs / 3);
	const s1Start = new Date(start);
	const s1End = new Date(start.getTime() + third);
	const s2Start = new Date(s1End.getTime() + 24 * 60 * 60 * 1000);
	const s2End = new Date(s2Start.getTime() + third);
	const s3Start = new Date(s2End.getTime() + 24 * 60 * 60 * 1000);
	const s3End = new Date(end);
	return [
		{ start: s1Start, end: s1End },
		{ start: s2Start, end: s2End },
		{ start: s3Start, end: s3End },
	];
}

// ---------------------------------------------------------------------------
// Helpers de idempotencia
// ---------------------------------------------------------------------------
async function getOrCreateUser(email: string, name: string, role: string, password: string) {
	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) return existing;
	return prisma.user.create({
		data: {
			email,
			name,
			password,
			role,
			avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.replace(/\s+/g, "")}`,
		},
	});
}

async function getOrCreateProject(name: string, ownerId: string, start: Date, end: Date) {
	const existing = await prisma.project.findFirst({
		where: { name, ownerId },
	});
	if (existing) {
		return prisma.project.update({
			where: { id: existing.id },
			data: {
				description: "Plataforma web para la reserva en línea de canchas deportivas, gestión de horarios y administración de instalaciones.",
				status: "COMPLETED",
				startDate: start,
				endDate: end,
			},
		});
	}
	return prisma.project.create({
		data: {
			name,
			description: "Plataforma web para la reserva en línea de canchas deportivas, gestión de horarios y administración de instalaciones.",
			status: "COMPLETED",
			ownerId,
			startDate: start,
			endDate: end,
		},
	});
}

async function ensureMember(projectId: string, userId: string, role: string) {
	const existing = await prisma.projectMember.findUnique({
		where: { projectId_userId: { projectId, userId } },
	});
	if (existing) {
		if (existing.role !== role) {
			await prisma.projectMember.update({
				where: { id: existing.id },
				data: { role },
			});
		}
		return;
	}
	await prisma.projectMember.create({
		data: { projectId, userId, role },
	});
}

async function getOrCreateSprint(
	projectId: string,
	name: string,
	description: string,
	start: Date,
	end: Date,
) {
	const existing = await prisma.sprint.findFirst({
		where: { projectId, name },
	});
	if (existing) {
		return prisma.sprint.update({
			where: { id: existing.id },
			data: {
				description,
				startDate: start,
				endDate: end,
				status: "COMPLETED",
			},
		});
	}
	return prisma.sprint.create({
		data: {
			projectId,
			name,
			description,
			startDate: start,
			endDate: end,
			status: "COMPLETED",
		},
	});
}

async function getOrCreateStory(
	projectId: string,
	sprintId: string,
	title: string,
	description: string,
	acceptance: string,
	priority: string,
	storyPoints: number,
	assigneeId: string,
	completedAt: Date,
) {
	const existing = await prisma.userStory.findFirst({
		where: { projectId, title },
	});
	if (existing) {
		return prisma.userStory.update({
			where: { id: existing.id },
			data: {
				description,
				acceptance,
				priority,
				storyPoints,
				status: "COMPLETED",
				completedAt,
				assigneeId,
				sprintId,
			},
		});
	}
	return prisma.userStory.create({
		data: {
			projectId,
			sprintId,
			title,
			description,
			acceptance,
			priority,
			storyPoints,
			status: "COMPLETED",
			completedAt,
			assigneeId,
		},
	});
}

async function getOrCreateTask(
	projectId: string,
	sprintId: string,
	userStoryId: string,
	title: string,
	description: string,
	priority: string,
	assigneeId: string,
	completedAt: Date,
	deadline: Date,
) {
	const existing = await prisma.task.findFirst({
		where: { projectId, title },
	});
	if (existing) {
		return prisma.task.update({
			where: { id: existing.id },
			data: {
				description,
				priority,
				status: "COMPLETED",
				completedAt,
				deadline,
				assigneeId,
				sprintId,
				userStoryId,
			},
		});
	}
	return prisma.task.create({
		data: {
			projectId,
			sprintId,
			userStoryId,
			title,
			description,
			priority,
			status: "COMPLETED",
			completedAt,
			deadline,
			assigneeId,
		},
	});
}

// ---------------------------------------------------------------------------
// Plan de contenido: 3 sprints para el sistema de reservas de canchas.
// ---------------------------------------------------------------------------
type StoryDef = {
	title: string;
	description: string;
	acceptance: string;
	priority: string;
	storyPoints: number;
};

type TaskDef = {
	title: string;
	description: string;
	priority: string;
	storyIndex: number;
};

const SPRINT_PLANS: {
	name: string;
	description: string;
	stories: StoryDef[];
	tasks: TaskDef[];
}[] = [
	{
		name: "Sprint 1 - Reservas y Horarios",
		description: "Reserva de canchas en línea y gestión de horarios disponibles",
		stories: [
			{
				title: "Reserva de canchas en línea",
				description: "Como cliente quiero reservar una cancha en línea para asegurar mi horario.",
				acceptance: "El sistema muestra disponibilidad, permite elegir fecha/hora y confirma la reserva.",
				priority: "HIGH",
				storyPoints: 8,
			},
			{
				title: "Gestión de horarios disponibles",
				description: "Como administrador quiero gestionar los horarios de las canchas para evitar choques.",
				acceptance: "Se pueden crear, editar y bloquear horarios por cancha y fecha.",
				priority: "HIGH",
				storyPoints: 5,
			},
			{
				title: "Pago de reservas",
				description: "Como cliente quiero pagar en línea mi reserva y recibir un comprobante.",
				acceptance: "Integración con pasarela de pago y comprobante descargable.",
				priority: "MEDIUM",
				storyPoints: 13,
			},
		],
		tasks: [
			{ title: "Diseñar modelo de datos de canchas", description: "Modelo de datos de canchas y horarios.", priority: "HIGH", storyIndex: 0 },
			{ title: "API de disponibilidad de horarios", description: "Endpoint de consulta de disponibilidad.", priority: "HIGH", storyIndex: 0 },
			{ title: "Formulario de reserva (frontend)", description: "Formulario para reservar cancha.", priority: "MEDIUM", storyIndex: 0 },
			{ title: "CRUD de canchas para administrador", description: "Gestión de canchas por admin.", priority: "MEDIUM", storyIndex: 1 },
			{ title: "Vista de calendario de horarios", description: "Calendario de disponibilidad.", priority: "LOW", storyIndex: 1 },
			{ title: "Integración con pasarela de pago", description: "Integración de pago en línea.", priority: "HIGH", storyIndex: 2 },
		],
	},
	{
		name: "Sprint 2 - Gestión y Reportes",
		description: "Administración de canchas, reportes de uso y notificaciones",
		stories: [
			{
				title: "Administración de canchas",
				description: "Como administrador quiero crear y editar canchas con sus características.",
				acceptance: "Se pueden registrar canchas con tipo, precio y estado de disponibilidad.",
				priority: "HIGH",
				storyPoints: 8,
			},
			{
				title: "Reportes de uso de canchas",
				description: "Como administrador quiero ver reportes de ocupación para tomar decisiones.",
				acceptance: "El panel muestra ocupación por cancha y por rango de fechas.",
				priority: "MEDIUM",
				storyPoints: 5,
			},
			{
				title: "Notificaciones de reservas",
				description: "Como cliente quiero recibir avisos de confirmación y recordatorio de mi reserva.",
				acceptance: "Se envían avisos de confirmación, recordatorio y cancelación.",
				priority: "MEDIUM",
				storyPoints: 5,
			},
			{
				title: "Refinamiento del backlog",
				description: "Como Product Owner quiero refinar y priorizar las historias pendientes.",
				acceptance: "El backlog queda priorizado con criterios de aceptación claros.",
				priority: "LOW",
				storyPoints: 3,
			},
		],
		tasks: [
			{ title: "CRUD de canchas (crear/editar)", description: "Endpoints de gestión de canchas.", priority: "HIGH", storyIndex: 0 },
			{ title: "Métricas de ocupación por cancha", description: "Cálculo de ocupación.", priority: "MEDIUM", storyIndex: 1 },
			{ title: "Definir plantillas de notificación", description: "Plantillas de emails/SMS.", priority: "MEDIUM", storyIndex: 2 },
			{ title: "Email de confirmación de reserva", description: "Envío de confirmación por email.", priority: "HIGH", storyIndex: 2 },
			{ title: "Refinar criterios de aceptación", description: "Refinamiento de HU pendientes.", priority: "LOW", storyIndex: 3 },
		],
	},
	{
		name: "Sprint 3 - Cierre y Mejoras",
		description: "Notificaciones avanzadas, reportes y panel de administración",
		stories: [
			{
				title: "Notificaciones por email y SMS",
				description: "Como cliente quiero recibir notificaciones por email y SMS de mis reservas.",
				acceptance: "Se envían notificaciones por ambos canales de forma confiable.",
				priority: "MEDIUM",
				storyPoints: 5,
			},
			{
				title: "Reportes de ocupación avanzados",
				description: "Como administrador quiero reportes avanzados de ocupación y cancelaciones.",
				acceptance: "El panel muestra gráficos de ocupación y cancelaciones por período.",
				priority: "MEDIUM",
				storyPoints: 8,
			},
			{
				title: "Panel de administración",
				description: "Como administrador quiero un panel central para gestionar el sistema.",
				acceptance: "El panel permite gestionar canchas, horarios y reservas.",
				priority: "HIGH",
				storyPoints: 5,
			},
		],
		tasks: [
			{ title: "Integración con servicio de email", description: "Configuración de envío de emails.", priority: "HIGH", storyIndex: 0 },
			{ title: "Integración con servicio de SMS", description: "Configuración de envío de SMS.", priority: "MEDIUM", storyIndex: 0 },
			{ title: "Gráfico de ocupación por período", description: "Visualización de ocupación.", priority: "MEDIUM", storyIndex: 1 },
			{ title: "Reporte de cancelaciones", description: "Listado y métricas de cancelaciones.", priority: "LOW", storyIndex: 1 },
			{ title: "Vista principal del panel admin", description: "Dashboard de administración.", priority: "HIGH", storyIndex: 2 },
			{ title: "Gestión de reservas desde el panel", description: "CRUD de reservas para admin.", priority: "MEDIUM", storyIndex: 2 },
		],
	},
];

async function main() {
	console.log("🌱 Creando proyecto realista de canchas con 3 sprints (mes anterior)...");

	const { start: monthStart, end: monthEnd } = previousMonthRange();
	const sprintRanges = splitIntoThree(monthStart, monthEnd);

	const adminPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
	const admin = await prisma.user.upsert({
		where: { email: ADMIN_EMAIL },
		update: {},
		create: {
			email: ADMIN_EMAIL,
			name: "Admin Docente",
			password: adminPassword,
			role: "ADMIN",
			avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
		},
	});

	const integrantes = [];
	for (const m of INTEGRANTES) {
		const password = await bcrypt.hash("password123", 10);
		const user = await getOrCreateUser(m.email, m.name, "TEAM_DEVELOPER", password);
		integrantes.push({ ...m, user });
	}

	const project = await getOrCreateProject(PROJECT_NAME, admin.id, monthStart, monthEnd);

	for (const m of integrantes) {
		await ensureMember(project.id, m.user.id, m.role);
	}

	let totalStories = 0;
	let totalTasks = 0;

	for (let i = 0; i < SPRINT_PLANS.length; i++) {
		const plan = SPRINT_PLANS[i];
		const range = sprintRanges[i];
		const sprint = await getOrCreateSprint(
			project.id,
			plan.name,
			plan.description,
			range.start,
			range.end,
		);

		const createdStories = [];
		for (const storyDef of plan.stories) {
			const assignee = integrantes[createdStories.length % integrantes.length];
			const story = await getOrCreateStory(
				project.id,
				sprint.id,
				storyDef.title,
				storyDef.description,
				storyDef.acceptance,
				storyDef.priority,
				storyDef.storyPoints,
				assignee.user.id,
				range.end,
			);
			createdStories.push(story);
			totalStories++;
		}

		for (let t = 0; t < plan.tasks.length; t++) {
			const taskDef = plan.tasks[t];
			const story = createdStories[taskDef.storyIndex];
			const assignee = integrantes[t % integrantes.length];
			await getOrCreateTask(
				project.id,
				sprint.id,
				story.id,
				taskDef.title,
				taskDef.description,
				taskDef.priority,
				assignee.user.id,
				range.end,
				range.end,
			);
			totalTasks++;
		}

		console.log(
			`✔ ${plan.name}: ${plan.stories.length} HU, ${plan.tasks.length} tareas (${range.start.toISOString().slice(0, 10)} → ${range.end.toISOString().slice(0, 10)})`,
		);
	}

	console.log("\n✅ Proyecto realista creado/actualizado.");
	console.log(`   Proyecto : ${project.name} (${project.id})`);
	console.log(`   Estado   : COMPLETED`);
	console.log(`   Rango    : ${monthStart.toISOString().slice(0, 10)} → ${monthEnd.toISOString().slice(0, 10)}`);
	console.log(`   Sprints  : ${SPRINT_PLANS.length} (todos COMPLETED)`);
	console.log(`   HU       : ${totalStories} (todas COMPLETED)`);
	console.log(`   Tareas   : ${totalTasks} (todas COMPLETED)`);
	console.log(`   Miembros : ${integrantes.map((m) => `${m.name} (${m.role})`).join(", ")}`);
	console.log(`   Owner    : ${admin.email} (ADMIN)`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});