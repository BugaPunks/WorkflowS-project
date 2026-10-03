import { type APIRequestContext, expect, test } from "@playwright/test";
import "dotenv/config";
import jwt from "jsonwebtoken";
import {
	API_ORIGIN,
	extractTokenFromSetCookie,
	TEST_PASSWORD,
} from "./utils/api-auth";

const api = (path: string) => `${API_ORIGIN}${path}`;

const GENERIC_LOGIN_ERROR = { error: "Email o contraseña incorrectos" };

interface RegisterBody {
	name?: string;
	email?: string;
	password?: string;
	token?: string;
	role?: string;
	user?: { id: string; email: string; name: string; role: string };
	message?: string;
	error?: string;
}

async function register(
	request: APIRequestContext,
	body: Record<string, unknown>,
): Promise<{
	res: Awaited<ReturnType<APIRequestContext["post"]>>;
	body: RegisterBody;
}> {
	const res = await request.post(api("/api/auth/register"), { data: body });
	return { res, body: (await res.json()) as RegisterBody };
}

test.describe("Auth security hardening", () => {
	test("registro ignora el rol enviado por el cliente y no devuelve token", async ({
		request,
	}) => {
		const email = `role_escalation_${Date.now()}@test.com`;

		const { res, body } = await register(request, {
			name: "Escalation Attempt",
			email,
			password: TEST_PASSWORD,
			role: "ADMIN",
		});

		expect(res.status()).toBe(201);
		expect(body.user?.role).toBe("TEAM_DEVELOPER");
		expect(body.token).toBeUndefined();
		expect(res.headers()["set-cookie"]).toBeUndefined();
	});

	test("registro sin rol crea TEAM_DEVELOPER y no emite cookie de sesión", async ({
		request,
	}) => {
		const email = `no_role_${Date.now()}@test.com`;

		const { res, body } = await register(request, {
			name: "No Role",
			email,
			password: TEST_PASSWORD,
		});

		expect(res.status()).toBe(201);
		expect(body.user?.role).toBe("TEAM_DEVELOPER");
		expect(res.headers()["set-cookie"]).toBeUndefined();
	});

	test("login responde 401 uniforme ante email desconocido, contraseña incorrecta y usuario desactivado", async ({
		request,
	}) => {
		const stamp = Date.now();
		const targetEmail = `inactive_${stamp}@test.com`;

		// Sesión de ADMIN sembrado para poder desactivar al usuario objetivo.
		const adminLogin = await request.post(api("/api/auth/login"), {
			data: { email: "admin@workflow.com", password: "admin123" },
		});
		expect(adminLogin.status()).toBe(200);
		const adminToken = extractTokenFromSetCookie(adminLogin.headers());
		expect(adminToken).toBeTruthy();

		// Usuario activo con contraseña conocida.
		const { body: registered } = await register(request, {
			name: "To Be Deactivated",
			email: targetEmail,
			password: TEST_PASSWORD,
		});
		expect(registered.user?.id).toBeTruthy();

		// Desactivarlo desde el panel de administración.
		const deactivate = await request.put(
			api(`/api/users/${registered.user?.id}`),
			{
				headers: { Authorization: `Bearer ${adminToken}` },
				data: { active: false },
			},
		);
		expect(deactivate.status()).toBe(200);

		// 1. Email desconocido
		const unknown = await request.post(api("/api/auth/login"), {
			data: { email: `ghost_${stamp}@test.com`, password: TEST_PASSWORD },
		});
		expect(unknown.status()).toBe(401);
		expect(await unknown.json()).toEqual(GENERIC_LOGIN_ERROR);
		expect(unknown.headers()["set-cookie"]).toBeUndefined();

		// 2. Contraseña incorrecta
		const wrongPassword = await request.post(api("/api/auth/login"), {
			data: { email: targetEmail, password: "WrongPassword!1" },
		});
		expect(wrongPassword.status()).toBe(401);
		expect(await wrongPassword.json()).toEqual(GENERIC_LOGIN_ERROR);
		expect(wrongPassword.headers()["set-cookie"]).toBeUndefined();

		// 3. Usuario desactivado con la contraseña correcta
		const inactive = await request.post(api("/api/auth/login"), {
			data: { email: targetEmail, password: TEST_PASSWORD },
		});
		expect(inactive.status()).toBe(401);
		expect(await inactive.json()).toEqual(GENERIC_LOGIN_ERROR);
		expect(inactive.headers()["set-cookie"]).toBeUndefined();
	});

	test("login exitoso entrega cookie httpOnly SameSite=Lax sin token en el body", async ({
		request,
	}) => {
		const email = `cookie_${Date.now()}@test.com`;
		await register(request, {
			name: "Cookie User",
			email,
			password: TEST_PASSWORD,
		});

		const res = await request.post(api("/api/auth/login"), {
			data: { email, password: TEST_PASSWORD },
		});

		expect(res.status()).toBe(200);
		const body = (await res.json()) as { token?: string };
		expect(body.token).toBeUndefined();

		const setCookie = res.headers()["set-cookie"];
		expect(setCookie).toBeTruthy();
		const cookie =
			(Array.isArray(setCookie) ? setCookie : [setCookie])[0] ?? "";
		expect(cookie).toMatch(/^token=/);
		expect(cookie.toLowerCase()).toContain("httponly");
		expect(cookie.toLowerCase()).toContain("samesite=lax");
	});

	test("logout revoca los tokens emitidos previamente", async ({ request }) => {
		const email = `logout_${Date.now()}@test.com`;
		await register(request, {
			name: "Logout User",
			email,
			password: TEST_PASSWORD,
		});

		const login = await request.post(api("/api/auth/login"), {
			data: { email, password: TEST_PASSWORD },
		});
		const token = extractTokenFromSetCookie(login.headers());
		expect(token).toBeTruthy();

		const beforeLogout = await request.get(api("/api/projects"), {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(beforeLogout.status()).toBe(200);

		const logout = await request.post(api("/api/auth/logout"), {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(logout.status()).toBe(200);
		const cleared = logout.headers()["set-cookie"] ?? "";
		expect(cleared.toString()).toMatch(/token=;/);

		const afterLogout = await request.get(api("/api/projects"), {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(afterLogout.status()).toBe(401);
		expect(afterLogout.headers()["www-authenticate"]).toBe("Bearer");
	});

	test("un token expirado se rechaza con 401 y WWW-Authenticate", async ({
		request,
	}) => {
		const secret = process.env.JWT_SECRET;
		expect(secret, "JWT_SECRET debe estar definido en .env").toBeTruthy();

		const expired = jwt.sign(
			{
				userId: "00000000-0000-0000-0000-000000000000",
				email: "expired@test.com",
				role: "TEAM_DEVELOPER",
				v: 0,
				iss: "workflows-api",
				aud: "workflows-web",
			},
			secret as string,
			{ algorithm: "HS256", expiresIn: "-1s" },
		);

		const res = await request.get(api("/api/projects"), {
			headers: { Authorization: `Bearer ${expired}` },
		});

		expect(res.status()).toBe(401);
		expect(res.headers()["www-authenticate"]).toBe("Bearer");
	});

	test("un request sin token se rechaza con 401 y WWW-Authenticate", async ({
		request,
	}) => {
		const res = await request.get(api("/api/projects"));

		expect(res.status()).toBe(401);
		expect(res.headers()["www-authenticate"]).toBe("Bearer");
	});

	test("CSRF: una mutación con Origin no permitido se rechaza con 403", async ({
		request,
	}) => {
		const res = await request.post(api("/api/auth/login"), {
			headers: { Origin: "http://attacker.example.com" },
			data: { email: "admin@workflow.com", password: "admin123" },
		});

		expect(res.status()).toBe(403);
		expect(res.headers()["set-cookie"]).toBeUndefined();
		expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
	});

	test("CSRF: una mutación sin Origin ni Referer se permite", async ({
		request,
	}) => {
		const res = await request.post(api("/api/auth/login"), {
			data: {
				email: `no_origin_${Date.now()}@test.com`,
				password: TEST_PASSWORD,
			},
		});

		expect(res.status()).not.toBe(403);
	});

	test("CORS: el preflight desde un origen configurado permite credenciales", async ({
		request,
	}) => {
		const res = await request.fetch(api("/api/projects"), {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:3000",
				"Access-Control-Request-Method": "GET",
			},
		});

		expect(res.headers()["access-control-allow-origin"]).toBe(
			"http://localhost:3000",
		);
		expect(res.headers()["access-control-allow-credentials"]).toBe("true");
	});
});

test.describe("Logout desde la UI", () => {
	test("el botón Cerrar Sesión revoca la sesión y bloquea las rutas protegidas", async ({
		page,
	}) => {
		// --- Login por la UI ---
		await page.goto("/login");
		await page.fill('input[name="email"]', "admin@workflow.com");
		await page.fill('input[name="password"]', "admin123");
		await page.getByRole("button", { name: "Iniciar sesión" }).click();
		await page.waitForURL("http://localhost:3000/");

		// El token viaja solo en la cookie httpOnly.
		const cookiesAfterLogin = await page.context().cookies();
		const sessionCookie = cookiesAfterLogin.find((c) => c.name === "token");
		expect(sessionCookie?.value, "cookie de sesión httpOnly").toBeTruthy();
		expect(sessionCookie?.httpOnly).toBe(true);
		expect(
			await page.evaluate(() => localStorage.getItem("token")),
			"el token no debe persistirse en localStorage",
		).toBeNull();

		// --- Navegación a una ruta protegida ---
		await page.goto("/user-management");
		await expect(page).toHaveURL(/\/user-management/);
		await expect(
			page.getByRole("button", { name: "+ Nuevo Usuario" }),
		).toBeVisible();

		// --- Logout desde el sidebar ---
		const logoutResponse = page.waitForResponse(
			(res) =>
				res.url().includes("/api/auth/logout") &&
				res.request().method() === "POST",
		);
		// El sidebar desktop etiqueta el botón como "Salir" y el colapsado como
		// "Cerrar Sesión" (sr-only), así que se aceptan ambos nombres.
		await page.getByRole("button", { name: /^(Salir|Cerrar Sesión)$/ }).click();
		expect((await logoutResponse).status()).toBe(200);
		await page.waitForURL(/\/login/);

		// La cookie se limpia y el estado local se vacía.
		expect(
			(await page.context().cookies()).find((c) => c.name === "token"),
			"la cookie de sesión debe eliminarse",
		).toBeUndefined();
		expect(await page.evaluate(() => localStorage.getItem("user"))).toBeNull();

		// --- El token anterior queda revocado en el servidor ---
		const revoked = await page.request.get(api("/api/projects"), {
			headers: { Authorization: `Bearer ${sessionCookie?.value}` },
		});
		expect(revoked.status()).toBe(401);

		// --- Las rutas protegidas ya no son accesibles ---
		await page.goto("/user-management");
		await expect(page).toHaveURL(/\/login/);
	});
});
