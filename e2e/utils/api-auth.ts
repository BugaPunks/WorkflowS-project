import type { APIRequestContext, Page } from "@playwright/test";

export async function loginViaApi(
	ctx: APIRequestContext | Page,
	arg2?: string | APIRequestContext,
	arg3?: string,
	arg4?: string,
	arg5?: string,
) {
	let request: APIRequestContext;
	let page: Page | undefined;

	let email = `user${Date.now()}@example.com`;
	let password = "password123";
	let name = "Test User";
	let role: "ADMIN" | "TEAM_DEVELOPER" | "PRODUCT_OWNER" | "SCRUM_MASTER" =
		"TEAM_DEVELOPER";

	// --- 1. Determine Request & Page ---
	// Check if ctx is Page (has 'goto')
	if ("goto" in ctx) {
		page = ctx as Page;
		request = page.request;

		// Handle overload: loginViaApi(page, request, email, ...)
		if (arg2 && typeof arg2 !== "string" && "post" in arg2) {
			// arg2 is Request, ignore it as we have page.request
			if (arg3) email = arg3;
			// Heuristic for the rest: tests often pass (page, request, email, role)
			// effectively skipping password/name or passing role as password
			if (arg4) {
				if (
					["ADMIN", "TEAM_DEVELOPER", "PRODUCT_OWNER", "SCRUM_MASTER"].includes(
						arg4,
					)
				) {
					role = arg4 as any;
				} else {
					password = arg4;
				}
			}
			if (arg5) name = arg5;
		} else {
			// loginViaApi(page, email, password, name, role)
			if (arg2) email = arg2 as string;
			if (arg3) password = arg3;
			if (arg4) name = arg4;
			if (arg5) role = arg5 as any;
		}
	} else {
		// ctx is Request
		request = ctx as APIRequestContext;
		if (arg2 && typeof arg2 === "string") email = arg2;
		if (arg3) password = arg3;
		if (arg4) name = arg4;
		if (arg5) role = arg5 as any;
	}

	// --- Fix for shortcuts and validation ---
	if (email === "admin") {
		email = "admin@workflow.com";
		if (password === "password123") password = "admin123";
		role = "ADMIN";
	} else if (email === "docente") {
		email = "admin@workflow.com";
		if (password === "password123") password = "admin123";
		role = "ADMIN";
	} else if (email === "student") {
		email = "dev2@workflow.com";
		if (password === "password123") password = "password123";
		role = "TEAM_DEVELOPER";
	} else if (email === "grade_admin") {
		email = "grade_admin@example.com";
		if (password === "password123") password = "password123";
		role = "ADMIN";
	} else if (email === "admin_retro") {
		email = "admin_retro@example.com";
		if (password === "password123") password = "password123";
		role = "ADMIN";
	} else if (email === "admin_eval") {
		email = "admin_eval@example.com";
		if (password === "password123") password = "password123";
		role = "ADMIN";
	} else if (email === "chat_user") {
		email = "chat_user@example.com";
		if (password === "password123") password = "password123";
		role = "ADMIN";
	} else if (email === "scrum_master") {
		email = "scrum_master@example.com";
		if (password === "password123") password = "password123";
		role = "ADMIN";
	} else if (!email.includes("@")) {
		email = `${email}@example.com`;
	}

	// --- 2. Perform API Auth ---
	// Register
	const registerRes = await request.post("/api/auth/register", {
		data: { name, email, password, role },
	});

	let userId = "";
	let authToken: string | null = null;

	if (!registerRes.ok()) {
		// Maybe exists, try login
		const loginRes = await request.post("/api/auth/login", {
			data: { email, password },
		});
		if (loginRes.ok()) {
			const data = await loginRes.json();
			userId = data.user.id;
			authToken = data.token;
		} else {
			throw new Error(
				`Auth failed for ${email} with pass ${password}. Status: ${loginRes.status()}`,
			);
		}
	} else {
		const data = await registerRes.json();
		userId = data.user.id;
		authToken = data.token;
	}

	// --- 3. Inject Session into Page (if available) ---
	if (page && authToken) {
		if (page.url() === "about:blank") {
			await page.goto("/login");
		}

		await page.evaluate(
			({ id, name, email, role, token }) => {
				localStorage.setItem("user", JSON.stringify({ id, name, email, role }));
				localStorage.setItem("token", token);
			},
			{ id: userId, name, email, role, token: authToken },
		);
	}

	return { id: userId, email, name, role, token: authToken };
}
