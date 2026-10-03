import { expect, test } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

const API_ORIGIN = "http://localhost:5000";

/**
 * RF8.1 · Verificación de caja blanca del burndown (Iteracion3.md §7.a).
 *
 * El backend calcula `daysDiff = ceil((endDate - startDate) / 24h)` y el
 * decremento ideal como `totalPoints / daysDiff` (src/server/routes/metrics.ts:46-70).
 * Para un sprint de 10 días con 100 puntos el decremento debe ser 10, de modo que
 * el día 5 marque exactamente 50 puntos restantes: `100 - (10 * 5)`.
 *
 * La serie va de `day = 0` a `day = daysDiff` inclusive (metrics.ts:61), es decir
 * 11 puntos para un sprint de 10 días.
 */
const TOTAL_POINTS = 100;
const DAYS_DIFF = 10;

const isoDay = (date: Date) => date.toISOString().split("T")[0];

interface BurndownResponse {
	data: {
		totalPoints: number;
		series: {
			day: number;
			date: string;
			ideal: number;
			actual: number | null;
		}[];
	};
}

test.describe("RF8 — Métricas y reportes (HU-08)", () => {
	test("MET-01 · RF8.1 la línea ideal del burndown cae linealmente hasta 0 (100 pts / 10 días → día 5 = 50)", async ({
		page,
		request,
	}) => {
		const { id: userId, token } = await loginViaApi(
			page,
			request,
			"admin",
			"ADMIN",
		);
		const auth = { Authorization: `Bearer ${token}` };
		const ts = Date.now();

		// --- Arrange: proyecto con ownerId (campo obligatorio en POST /api/projects) ---
		const projectRes = await request.post(`${API_ORIGIN}/api/projects`, {
			headers: auth,
			data: {
				name: `Metrics Project ${ts}`,
				description: "For Metrics",
				ownerId: userId,
			},
		});
		expect(
			projectRes.status(),
			"POST /api/projects exige ownerId y debe devolver 201",
		).toBe(201);
		const { data: project } = (await projectRes.json()) as {
			data: { id: string };
		};

		// --- Arrange: sprint de 10 días (diferencia exacta de 10 días) ---
		const start = new Date();
		const end = new Date(start.getTime() + DAYS_DIFF * 86_400_000);
		const sprintRes = await request.post(`${API_ORIGIN}/api/sprints`, {
			headers: auth,
			data: {
				name: `Sprint Metricas ${ts}`,
				projectId: project.id,
				startDate: isoDay(start),
				endDate: isoDay(end),
			},
		});
		expect(sprintRes.status()).toBe(201);
		const { data: sprint } = (await sprintRes.json()) as {
			data: { id: string };
		};

		// --- Arrange: historias que suman 100 puntos, una de ellas completada ---
		const points = [40, 30, 30];
		const storyIds: string[] = [];
		for (const [index, storyPoints] of points.entries()) {
			const storyRes = await request.post(`${API_ORIGIN}/api/user-stories`, {
				headers: auth,
				data: {
					title: `Historia Metricas ${ts}-${index}`,
					description: "Historia creada por metrics.spec.ts",
					projectId: project.id,
					storyPoints,
					priority: "HIGH",
				},
			});
			expect(storyRes.status()).toBe(201);
			const { data: story } = (await storyRes.json()) as {
				data: { id: string };
			};
			storyIds.push(story.id);

			// Asignar la historia al sprint (POST /api/sprints/:id/add-story)
			const addRes = await request.post(
				`${API_ORIGIN}/api/sprints/${sprint.id}/add-story`,
				{
					headers: auth,
					data: { userStoryId: story.id },
				},
			);
			expect(addRes.status()).toBe(201);
		}

		// Completar la historia de 40 puntos para que la línea real deje de ser nula
		const completeRes = await request.put(
			`${API_ORIGIN}/api/user-stories/${storyIds[0]}`,
			{ headers: auth, data: { status: "COMPLETED" } },
		);
		expect(completeRes.status()).toBe(200);

		// --- Act: pedir el burndown ---
		const burndownRes = await request.get(
			`${API_ORIGIN}/api/metrics/sprints/${sprint.id}/burndown`,
			{ headers: auth },
		);
		expect(burndownRes.status()).toBe(200);
		const { data } = (await burndownRes.json()) as BurndownResponse;

		// --- Assert: RF8.1 (caja blanca) ---
		expect(data.totalPoints).toBe(TOTAL_POINTS);
		expect(data.series).toHaveLength(DAYS_DIFF + 1);
		expect(data.series[0].ideal).toBe(100);
		expect(data.series[5].ideal).toBe(50); // 100 - (10 * 5)
		expect(data.series[10].ideal).toBe(0);

		// --- Assert: la serie ideal es estrictamente decreciente ---
		const ideals = data.series.map((p) => p.ideal);
		for (let i = 1; i < ideals.length; i++) {
			expect(ideals[i]).toBeLessThan(ideals[i - 1]);
		}

		// --- Assert: la línea real solo existe para los días ya transcurridos y
		// nunca supera los puntos totales. La historia se completa "ahora", así que
		// su quema todavía no aparece en ningún día elapsed: aquí se valida la
		// estructura real/ideal, no el consumo de puntos.
		const elapsed = data.series.filter((p) => p.actual !== null);
		const upcoming = data.series.filter((p) => p.actual === null);
		expect(elapsed.length).toBeGreaterThan(0);
		expect(upcoming.length).toBeGreaterThan(0);
		for (const point of elapsed) {
			expect(point.actual).toBeLessThanOrEqual(TOTAL_POINTS);
			expect(point.actual).toBeGreaterThanOrEqual(0);
		}
	});

	test("MET-02 · RF8.1/8.2/8.3 Reportes renderiza burndown, velocidad y contribución", async ({
		page,
		request,
	}) => {
		const {
			id: userId,
			email: userEmail,
			token,
		} = await loginViaApi(page, request, "admin", "ADMIN");
		const auth = { Authorization: `Bearer ${token}` };
		const ts = Date.now();
		const projectName = `Metrics UI ${ts}`;
		const sprintName = `Sprint UI ${ts}`;

		// --- Arrange: proyecto por API con ownerId ---
		const projectRes = await request.post(`${API_ORIGIN}/api/projects`, {
			headers: auth,
			data: { name: projectName, description: "For Metrics", ownerId: userId },
		});
		expect(projectRes.status()).toBe(201);
		const { data: project } = (await projectRes.json()) as {
			data: { id: string };
		};

		// --- Arrange: sprint ---
		const start = new Date();
		const end = new Date(start.getTime() + DAYS_DIFF * 86_400_000);
		const sprintRes = await request.post(`${API_ORIGIN}/api/sprints`, {
			headers: auth,
			data: {
				name: sprintName,
				projectId: project.id,
				startDate: isoDay(start),
				endDate: isoDay(end),
			},
		});
		expect(sprintRes.status()).toBe(201);
		const { data: sprint } = (await sprintRes.json()) as {
			data: { id: string };
		};

		// --- Arrange: historias en el sprint ---
		for (const [index, storyPoints] of [40, 30, 30].entries()) {
			const storyRes = await request.post(`${API_ORIGIN}/api/user-stories`, {
				headers: auth,
				data: {
					title: `Historia UI ${ts}-${index}`,
					description: "Historia creada por metrics.spec.ts",
					projectId: project.id,
					storyPoints,
				},
			});
			expect(storyRes.status()).toBe(201);
			const { data: story } = (await storyRes.json()) as {
				data: { id: string };
			};
			const addRes = await request.post(
				`${API_ORIGIN}/api/sprints/${sprint.id}/add-story`,
				{ headers: auth, data: { userStoryId: story.id } },
			);
			expect(addRes.status()).toBe(201);
		}

		// --- Arrange: tarea COMPLETED asignada, para que la contribución no esté vacía ---
		const taskRes = await request.post(`${API_ORIGIN}/api/tasks`, {
			headers: auth,
			data: {
				title: `Tarea Metricas ${ts}`,
				projectId: project.id,
				sprintId: sprint.id,
				assigneeId: userId,
				status: "COMPLETED",
			},
		});
		expect(taskRes.status()).toBe(201);

		// --- Arrange: leer la contribución desde la API para saber qué fila
		// debe aparecer en la tabla (el nombre real del usuario lo fija la BD)
		const contributionRes = await request.get(
			`${API_ORIGIN}/api/metrics/projects/${project.id}/contribution`,
			{ headers: auth },
		);
		expect(contributionRes.status()).toBe(200);
		const { data: contribution } = (await contributionRes.json()) as {
			data: { user: { id: string; name: string }; count: number }[];
		};
		expect(contribution).toHaveLength(1);
		expect(contribution[0].user.id).toBe(userId);
		expect(contribution[0].count).toBe(1);

		// --- Act: abrir Reportes ---
		await page.goto("/reports");

		// --- Assert: selector de proyecto y sección (HU-08, criterio de aceptación) ---
		await expect(
			page.getByRole("heading", { name: "Reportes y Métricas" }),
		).toBeVisible();
		const projectSelect = page.locator("#project-select");
		await expect(projectSelect).toBeVisible();
		await projectSelect.selectOption({ label: projectName });

		// --- Assert: el sprint del proyecto aparece en el selector de burndown ---
		const sprintSelect = page.locator("#sprint-select");
		await expect(sprintSelect).toBeEnabled();
		await expect(
			sprintSelect.locator("option", { hasText: sprintName }),
		).toHaveCount(1);
		await expect(sprintSelect).toHaveValue(sprint.id);

		// --- Assert: gráfico de burndown renderizado con los 100 puntos ---
		await expect(
			page.getByRole("heading", { name: "Burndown Chart" }),
		).toBeVisible();
		await expect(page.getByText("Puntos Totales:")).toBeVisible();
		await expect(
			page.locator("span.font-bold", { hasText: String(TOTAL_POINTS) }),
		).toBeVisible();

		// --- Assert: gráfico de velocidad con datos (no debe mostrar el estado vacío) ---
		await expect(
			page.getByRole("heading", { name: /Velocidad del Equipo/ }),
		).toBeVisible();
		await expect(page.getByText("No hay datos de velocidad.")).toHaveCount(0);
		await expect(page.getByText("Comprometido", { exact: true })).toBeVisible();

		// --- Assert: Recharts pintó los dos gráficos ---
		expect(
			await page.locator(".recharts-surface").count(),
		).toBeGreaterThanOrEqual(2);

		// --- Assert: RF8.2 contribución individual ---
		await expect(
			page.getByRole("heading", { name: /Contribución Individual/ }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: "Usuario" }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: "Tareas Completadas" }),
		).toBeVisible();
		await expect(
			page.getByRole("row", { name: new RegExp(contribution[0].user.name) }),
		).toBeVisible();
		await expect(
			page.getByRole("cell").filter({ hasText: userEmail }),
		).toBeVisible();
	});
});
