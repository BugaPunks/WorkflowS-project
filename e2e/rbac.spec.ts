import { expect, request as playwrightRequest, test } from "@playwright/test";
import { BASE_ORIGIN, loginViaApi } from "./utils/api-auth";

test.describe("Role-based access control (RNF3.2)", () => {
	let adminToken: string;
	let devToken: string;
	let devId: string;
	let adminContext: any;
	let devContext: any;

	test.beforeEach(async ({ request }) => {
		adminContext = await playwrightRequest.newContext({ baseURL: BASE_ORIGIN });
		const adminLoginRes = await adminContext.post("/api/auth/login", {
			data: { email: "admin@workflow.com", password: "admin123" },
		});
		adminToken = (await adminLoginRes.json()).token;

		devContext = await playwrightRequest.newContext({ baseURL: BASE_ORIGIN });
		const devLoginRes = await devContext.post("/api/auth/login", {
			data: { email: "dev2@workflow.com", password: "password123" },
		});
		const resJson = await devLoginRes.json();
		devToken = resJson.token;
		devId = resJson.user.id;
	});

	test("member is denied contribution endpoint and evaluations API with 403, while ADMIN keeps access", async () => {
		// Dev requests contribution
		const devContrib = await devContext.get(
			"/api/metrics/projects/some-project-id/contribution",
			{
				headers: { Authorization: `Bearer ${devToken}` },
			},
		);
		expect(devContrib.status()).toBe(403);

		// Dev requests evaluations API
		const devEval = await devContext.get(
			"/api/evaluations/project/some-project-id/general",
			{
				headers: { Authorization: `Bearer ${devToken}` },
			},
		);
		expect(devEval.status()).toBe(403);

		// Admin requests contribution
		const adminContrib = await adminContext.get(
			"/api/metrics/projects/some-project-id/contribution",
			{
				headers: { Authorization: `Bearer ${adminToken}` },
			},
		);
		// 404 is fine because project doesn't exist, but it's not 403.
		// Wait, the metrics route will return 200 or 500, but not 403.
		expect(adminContrib.status()).not.toBe(403);

		// Admin requests evaluations API
		const adminEval = await adminContext.get(
			"/api/evaluations/project/some-project-id/general",
			{
				headers: { Authorization: `Bearer ${adminToken}` },
			},
		);
		expect(adminEval.status()).not.toBe(403);
	});

	test("member still receives their own evaluations after the restriction", async () => {
		// Dev requests their own evaluations
		const devSelfEval = await devContext.get(
			`/api/evaluations/student/${devId}`,
			{
				headers: { Authorization: `Bearer ${devToken}` },
			},
		);
		// 200 means access granted
		expect(devSelfEval.status()).toBe(200);
	});
});
