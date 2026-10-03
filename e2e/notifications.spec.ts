import { expect, test } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

const API_ORIGIN = "http://localhost:5000";

test.describe("RF9 — Notificaciones (HU-09)", () => {
	test("NTF-01 · una tarea asignada genera una notificación que el usuario puede marcar como leída", async ({
		page,
		request,
	}) => {
		// --- Arrange: sesión de ADMIN ---
		const { id: userId, token } = await loginViaApi(
			page,
			request,
			"admin",
			"ADMIN",
		);
		const auth = { Authorization: `Bearer ${token}` };
		const ts = Date.now();
		const projectName = `Notif Project ${ts}`;
		const taskTitle = `Tarea Notificación ${ts}`;

		// --- Arrange: proyecto vía API (ownerId es obligatorio) ---
		const projectRes = await request.post(`${API_ORIGIN}/api/projects`, {
			headers: auth,
			data: { name: projectName, description: "Notificaciones", ownerId: userId },
		});
		expect(projectRes.status()).toBe(201);
		const { data: project } = (await projectRes.json()) as {
			data: { id: string };
		};

		// --- Arrange: tarea asignada al propio usuario.
		// La aserción es obligatoria: si la tarea no se crea, no hay notificación
		// que verificar y el test debe fallar en lugar de continuar.
		const taskRes = await request.post(`${API_ORIGIN}/api/tasks`, {
			headers: auth,
			data: {
				title: taskTitle,
				description: "Testing notifications",
				projectId: project.id,
				assigneeId: userId,
				status: "TODO",
			},
		});
		expect(taskRes.status(), "la tarea debe crearse y disparar TASK_ASSIGNED").toBe(
			201,
		);

		// --- Arrange: comprobar el registro en la API antes de mirar la UI ---
		const listRes = await request.get(
			`${API_ORIGIN}/api/notifications?userId=${userId}`,
			{ headers: auth },
		);
		expect(listRes.status()).toBe(200);
		const { data: created } = (await listRes.json()) as {
			data: { id: string; title: string; message: string; read: boolean }[];
		};
		const mine = created.find((n) => n.message === `Se te ha asignado la tarea: ${taskTitle}`);
		if (!mine) {
			throw new Error(
				`El backend no insertó la notificación TASK_ASSIGNED para la tarea "${taskTitle}"`,
			);
		}
		expect(mine.read).toBe(false);

		// --- Act: cargar la app; el NotificationBell hace polling al montar ---
		await page.goto("/projects");
		await page.reload();

		const bell = page.getByLabel("Notificaciones");
		const badge = bell.locator("span").first();

		// --- Assert: el indicador de no leídas aparece tras la recarga ---
		await expect(badge).toBeVisible({ timeout: 15000 });

		// --- Act: abrir el panel ---
		await bell.click();

		// --- Assert: título y mensaje del evento (Tabla 24 de Iteracion3.md) ---
		await expect(
			page.getByRole("heading", { name: "Nueva Tarea Asignada" }).first(),
		).toBeVisible({ timeout: 15000 });
		await expect(
			page.getByText(`Se te ha asignado la tarea: ${taskTitle}`).first(),
		).toBeVisible();

		// --- Assert: la notificación aparece como no leída ---
		const unreadBefore = await page.getByText("No leído", { exact: true }).count();
		expect(unreadBefore).toBeGreaterThan(0);

		// --- Act: marcar esa notificación como leída ---
		await page.locator("button", { hasText: taskTitle }).click();

		// --- Assert: el contador de no leídas disminuye en uno ---
		await expect(page.getByText("No leído", { exact: true })).toHaveCount(
			unreadBefore - 1,
		);

		// --- Assert: el estado persiste en el servidor (RF9.2 + polling) ---
		await expect
			.poll(
				async () => {
					const res = await request.get(
						`${API_ORIGIN}/api/notifications?userId=${userId}`,
						{ headers: auth },
					);
					const body = (await res.json()) as {
						data: { id: string; read: boolean }[];
					};
					return body.data.find((n) => n.id === mine.id)?.read;
				},
				{ timeout: 10000 },
			)
			.toBe(true);
	});
});