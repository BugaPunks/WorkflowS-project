import { expect, test } from "@playwright/test";
import {
	createSessionViaApi,
	loginViaApi,
	switchBrowserSession,
	TEST_PASSWORD,
} from "./utils/api-auth";

test.describe("Full Project Lifecycle: Teacher and Student", () => {
	const timestamp = Date.now();
	const projectName = `Proyecto Final ${timestamp}`;
	const studentEmail = `estudiante_${timestamp}@workflow.com`;
	const studentPassword = TEST_PASSWORD;
	let projectId: string;
	let studentId: string;
	let studentToken: string;

	test("Should verify the complete flow from creation to grading", async ({
		page,
		request,
	}) => {
		// =================================================================
		// 1. TEACHER: Setup Project & Users
		// =================================================================
		console.log("--- Step 1: Teacher Setup ---");

		// Login as Teacher (Admin)
		const { id: teacherId, token } = await loginViaApi(
			page,
			request,
			"docente",
			"ADMIN",
		);

		// 1.1 Create Project (UI)
		await page.goto("/projects");
		await page.waitForLoadState('networkidle');

		const btn = page.getByRole("button", { name: "Nuevo Proyecto" });
		if (!await btn.isVisible()) {
			console.log('Button not found by role, trying text');
			await page.click('text=Nuevo Proyecto');
		} else {
			await btn.click();
		}
		await page.fill('input[name="name"]', projectName);
		await page.fill('textarea[name="description"]', "Proyecto de prueba E2E");
		await page.getByRole("button", { name: "Crear Proyecto", exact: true }).click();

		await page
			.locator(".bg-white")
			.filter({ hasText: projectName })
			.first()
			.getByRole("button", { name: "Ver Proyecto" })
			.click();
		await expect(
			page.getByRole("heading", { name: projectName }),
		).toBeVisible();
		projectId = page.url().split("/projects/")[1];
		console.log(`Project Created: ${projectId}`);

		// 1.2 Create Rubric (API)
		await request.post("http://localhost:5000/api/rubrics", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				projectId: projectId,
				name: `Rúbrica General ${timestamp}`,
				criteria: [
					{ name: "Funcionalidad", maxScore: 10, weight: 1 },
					{ name: "Diseño", maxScore: 10, weight: 1 },
				],
			},
		});

		// 1.3 Create Student User (API)
		// El registro público siempre crea TEAM_DEVELOPER y no devuelve token,
		// por lo que se inicia sesión aparte para obtener la cookie de sesión.
		const student = await createSessionViaApi(request, undefined, {
			name: "Estudiante Test",
			email: studentEmail,
			password: studentPassword,
		});
		studentId = student.id;
		studentToken = student.token ?? "";

		// 1.4 Add Student to Project (UI)
		await page.getByRole("button", { name: "Miembros" }).click();
		const usersPromise = page.waitForResponse(
			(resp) => resp.url().includes("/api/users") && resp.status() === 200,
		);
		await page.getByRole("button", { name: "+ Añadir Miembro" }).click();
		await usersPromise;

		const userSelect = page.locator("#user-select");
		await userSelect.selectOption({ value: studentId });
		await page.locator("#role-select").selectOption("SCRUM_MASTER");

		const addMemberPromise = page.waitForResponse(
			(resp) => resp.url().includes("/api/projects") && resp.url().includes("/members") && resp.status() === 201,
		);
		await page.getByRole("button", { name: "Añadir", exact: true }).click();
		await addMemberPromise;

		await expect(
			page.locator("div").filter({ hasText: "Estudiante Test" }).last()
		).toBeVisible();

		// =================================================================
		// 2. STUDENT: Work on Project
		// =================================================================
		console.log("--- Step 2: Student Workflow ---");

		await switchBrowserSession(
			page,
			{
				id: studentId,
				email: studentEmail,
				name: "Estudiante Test",
				role: "TEAM_DEVELOPER",
			},
			studentToken,
		);
		await page.reload();
		await page.goto("/");

		// 2.1 Create User Story
		await page.goto("/user-stories");
		await page.getByRole("button", { name: "+ Nueva Historia" }).click();
		await page.selectOption("#story-project", { label: projectName });
		await page.fill("#story-title", "Historia de Usuario E2E");
		await page.fill("#story-desc", "Como usuario quiero hacer X");
		await page.fill("#story-acceptance", "Debe funcionar bien");
		await page.selectOption("#story-priority", "HIGH");
		await page.getByRole("button", { name: "Crear", exact: true }).click();
		await expect(
			page.getByText("Historia de Usuario E2E").first(),
		).toBeVisible();

		// 2.2 Create Sprint
		await page.goto(`/projects/${projectId}`);
		await page.getByRole("button", { name: "+ Nuevo Sprint" }).click();
		const sprintName = `Sprint 1 ${timestamp}`;
		await page.fill("#sprint-name", sprintName);
		await page.fill("#sprint-desc", "Primer sprint");
		const today = new Date().toISOString().split("T")[0];
		const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
		await page.fill("#sprint-start", today);
		await page.fill("#sprint-end", tomorrow);
		await page.getByRole("button", { name: "Crear", exact: true }).click();
		await expect(page.getByText(sprintName)).toBeVisible();

		// Get Sprint ID for later use via API
		const sprintsRes = await request.get("http://localhost:5000/api/sprints", {
			headers: { Authorization: `Bearer ${token}` }
		});
		const sprintsData = await sprintsRes.json();
		const sprintObj = sprintsData.data.find((s: any) => s.name === sprintName);

		// 2.3 Close the Sprint (Simulate completion so it can be graded)
		// Assuming there is a button or we do it via API.
		// For simplicity and robustness, let's use API to close the sprint.
		await request.put(`http://localhost:5000/api/sprints/${sprintObj.id}`, {
			headers: { Authorization: `Bearer ${token}` },
			data: { status: "COMPLETED" }
		});


		// =================================================================
		// 3. TEACHER: Grade Sprint
		// =================================================================
		console.log("--- Step 3: Teacher Grading ---");

		await switchBrowserSession(
			page,
			{
				id: teacherId,
				email: "docente@workflow.com",
				name: "Docente Admin",
				role: "ADMIN",
			},
			token!,
		);
		await page.reload();

		// 3.1 Go to Evaluations
		await page.goto("/evaluations");

		// 3.2 Find Sprint
		await expect(page.getByText(sprintName)).toBeVisible();

		// 3.3 Grade
		await page
			.locator(".bg-white")
			.filter({ hasText: sprintName })
			.getByRole("button", { name: "Ir a Calificar" })
			.click();

		await expect(
			page.getByRole("heading", { name: "Calificar Sprint" }),
		).toBeVisible();

		const rubricSelect = page.locator("#rubric-select");
		await expect(rubricSelect).toBeVisible();
		const rubricName = `Rúbrica General ${timestamp}`;
		await rubricSelect.selectOption({ label: rubricName });

		const inputs = page.locator('input[type="number"]');
		await inputs.nth(0).fill("9");
		await inputs.nth(1).fill("8");

		await page.getByPlaceholder(/Proporcione un feedback general/).fill("Excelente trabajo en el sprint.");
		page.on('dialog', dialog => dialog.accept());
		await page.getByRole("button", { name: "Guardar Calificación" }).click();

		// 3.4 Verify return
		await expect(page).toHaveURL(/\/evaluations/);
		// Sprint should be gone from list
		await expect(page.getByText(sprintName)).not.toBeVisible();

		// =================================================================
		// 4. STUDENT: Retrospective & Velocity Check
		// =================================================================
		console.log("--- Step 4: Student Retrospective & Review ---");

		await switchBrowserSession(
			page,
			{
				id: studentId,
				email: studentEmail,
				name: "Estudiante Test",
				role: "TEAM_DEVELOPER",
			},
			studentToken,
		);
		await page.reload();

		// 4.1 Check Grade
		await page.goto("/evaluations");
		await expect(page.getByText(sprintName)).toBeVisible();
		await expect(page.getByText("Excelente trabajo en el sprint.")).toBeVisible();

		// 4.2 Velocity (Optional check)
		await page.goto("/reports");
		await page.waitForTimeout(1000);
		// Just ensure page loads without error
		await expect(page.getByText("Reportes y Métricas")).toBeVisible();
	});
});
