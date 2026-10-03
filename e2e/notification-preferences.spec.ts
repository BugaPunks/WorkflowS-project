import { randomUUID } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { BASE_ORIGIN, loginViaApi, TEST_PASSWORD } from "./utils/api-auth";

test.describe("Notification Preferences", () => {
	let userId: string;
	let token: string;
	let otherUserId: string;

	test.beforeEach(async ({ page }) => {
		const { id, token: sessionToken } = await loginViaApi(
			page,
			`notif_pref_${Date.now()}@test.com`,
			TEST_PASSWORD,
			"Docente Test",
			"ADMIN",
		);
		userId = id;
		token = sessionToken;
	});

	test("disabling a type suppresses its notification, re-enabling restores it, and one user's setting does not affect another", async ({
		request,
		page,
	}) => {
		// 1. Disable TASK_ASSIGNED
		await request.put(`/api/notification-preferences/TASK_ASSIGNED`, {
			headers: { Authorization: `Bearer ${token}` },
			data: { enabled: false },
		});

		// Log in as seeded admin to create project
		const adminContext = await playwrightRequest.newContext({
			baseURL: BASE_ORIGIN,
		});
		const adminLoginRes = await adminContext.post("/api/auth/login", {
			data: { email: "admin@workflow.com", password: "admin123" },
		});
		const adminToken = (await adminLoginRes.json()).token;

		// Setup a project for testing
		const projectRes = await adminContext.post("/api/projects", {
			headers: { Authorization: `Bearer ${adminToken}` },
			data: {
				name: "Test Project",
				description: "Test",
				ownerId: userId,
			},
		});
		const project = (await projectRes.json()).data;

		await adminContext.post(`/api/projects/${project.id}/members`, {
			headers: { Authorization: `Bearer ${adminToken}` },
			data: { userId, role: "TEAM_DEVELOPER" },
		});

		// Create a task assigned to user
		await request.post("/api/tasks", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				title: "Test Task 1",
				projectId: project.id,
				assigneeId: userId,
			},
		});

		// Verify no notification received
		const notifRes1 = await request.get(`/api/notifications?userId=${userId}`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const notifications1 = (await notifRes1.json()).data;
		expect(
			notifications1.filter((n: any) => n.type === "TASK_ASSIGNED").length,
		).toBe(0);

		// 2. Re-enable TASK_ASSIGNED
		await request.put(`/api/notification-preferences/TASK_ASSIGNED`, {
			headers: { Authorization: `Bearer ${token}` },
			data: { enabled: true },
		});

		// Create another task assigned to user
		await request.post("/api/tasks", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				title: "Test Task 2",
				projectId: project.id,
				assigneeId: userId,
			},
		});

		// Verify notification received
		const notifRes2 = await request.get(`/api/notifications?userId=${userId}`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const notifications2 = (await notifRes2.json()).data;
		expect(
			notifications2.filter((n: any) => n.type === "TASK_ASSIGNED").length,
		).toBe(1);

		// 3. One user's setting does not affect another
		// Log in as a different user
		const otherContext = await loginViaApi(
			await page.context().newPage(),
			`other_user_${Date.now()}@test.com`,
			TEST_PASSWORD,
		);

		// the other user should still have TASK_ASSIGNED enabled (by default)
		await adminContext.post(`/api/projects/${project.id}/members`, {
			headers: { Authorization: `Bearer ${adminToken}` },
			data: { userId: otherContext.id, role: "TEAM_DEVELOPER" },
		});

		await request.post("/api/tasks", {
			headers: { Authorization: `Bearer ${token}` }, // creating as admin
			data: {
				title: "Test Task 3",
				projectId: project.id,
				assigneeId: otherContext.id,
			},
		});

		const notifRes3 = await request.get(
			`/api/notifications?userId=${otherContext.id}`,
			{
				headers: { Authorization: `Bearer ${otherContext.token}` },
			},
		);
		const notifications3 = (await notifRes3.json()).data;
		expect(
			notifications3.filter((n: any) => n.type === "TASK_ASSIGNED").length,
		).toBe(1);
	});
});
