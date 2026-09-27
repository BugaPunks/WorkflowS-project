import type { APIRequestContext, Page } from "@playwright/test";
import { request as playwrightRequest } from "@playwright/test";

export const AUTH_COOKIE_NAME = "token";
export const BASE_ORIGIN = "http://localhost:3000";
export const API_ORIGIN = "http://localhost:5000";

// Contraseña que cumple la política fuerte (mayúscula, minúscula, dígito,
// >8 chars, no común) usada para registrar usuarios frescos en tests.
export const TEST_PASSWORD = "Str0ngPass!2026";

// Usuario admin sembrado en prisma/seed.ts, usado para promocionar roles en tests
const SEEDED_ADMIN_EMAIL = "admin@workflow.com";
const SEEDED_ADMIN_PASSWORD = "admin123";

// Usuario developer sembrado en prisma/seed.ts
const SEEDED_DEV_EMAIL = "dev2@workflow.com";
const SEEDED_DEV_PASSWORD = "password123";

type Role = "ADMIN" | "TEAM_DEVELOPER" | "PRODUCT_OWNER" | "SCRUM_MASTER";

const ROLES: readonly string[] = [
	"ADMIN",
	"TEAM_DEVELOPER",
	"PRODUCT_OWNER",
	"SCRUM_MASTER",
];

export interface AuthSession {
	id: string;
	email: string;
	name: string;
	role: string;
	token: string | null;
}

export function extractTokenFromSetCookie(
	headers: Record<string, string | string[] | undefined>,
): string | null {
	const setCookie = headers["set-cookie"];
	if (!setCookie) return null;
	const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
	for (const cookie of cookies) {
		const parts = cookie.split(";");
		const first = parts[0]?.trim();
		const idx = first?.indexOf("=");
		if (first && idx !== undefined && idx > 0) {
			const name = first.slice(0, idx).trim();
			if (name === AUTH_COOKIE_NAME) {
				return first.slice(idx + 1).trim();
			}
		}
	}
	return null;
}

export async function injectBrowserSession(
	page: Page,
	user: { id: string; email: string; name: string; role: string },
	token: string | null,
): Promise<void> {
	if (page.url() === "about:blank") {
		await page.goto("/login");
	}
	await page.context().addCookies([
		{
			name: AUTH_COOKIE_NAME,
			value: token ?? "",
			domain: "localhost",
			path: "/",
			httpOnly: true,
			sameSite: "Lax",
		},
	]);
	await page.evaluate((u) => {
		localStorage.setItem(
			"user",
			JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role }),
		);
	}, user);
}

interface LoginResponseBody {
	user?: { id: string; email: string; name: string; role: string };
	error?: string;
}

interface LoginResult {
	ok: boolean;
	user?: { id: string; email: string; name: string; role: string };
	token: string | null;
	error?: string;
}

async function doLogin(
	req: APIRequestContext,
	email: string,
	password: string,
): Promise<LoginResult> {
	const res = await req.post("/api/auth/login", {
		data: { email, password },
	});
	const body = (await res.json()) as LoginResponseBody;
	const token = extractTokenFromSetCookie(res.headers());
	return { ok: res.ok(), user: body.user, token, error: body.error };
}

async function promoteRole(
	req: APIRequestContext,
	userId: string,
	role: string,
): Promise<void> {
	const adminRes = await req.post("/api/auth/login", {
		data: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
	});
	if (!adminRes.ok()) {
		throw new Error(
			`No se pudo iniciar sesión como admin sembrado para promocionar rol. Status: ${adminRes.status()}`,
		);
	}
	const adminToken = extractTokenFromSetCookie(adminRes.headers());
	await req.put(`/api/users/${userId}`, {
		headers: { Authorization: `Bearer ${adminToken}` },
		data: { role },
	});
	// Cerrar sesión admin para no contaminar cookies de otros tests
	await req.post("/api/auth/logout", {
		headers: { Authorization: `Bearer ${adminToken}` },
	});
}

export interface CreateSessionOptions {
	name: string;
	email: string;
	password?: string;
	role?: Role;
}

/**
 * Crea un usuario vía registro público (siempre TEAM_DEVELOPER), opcionalmente
 * lo promueve de rol, inicia sesión y devuelve la sesión con el token extraído
 * de la cookie `token`. Si el email ya existe, simplemente inicia sesión.
 *
 * Si se pasa `page`, inyecta la sesión en el navegador (cookie httpOnly +
 * `localStorage.user`) sin tocar `localStorage.token`.
 *
 * El flujo de registro/login corre en un contexto HTTP aislado para no pisar la
 * cookie de sesión del contexto que recibe el llamador: el middleware lee la
 * cookie antes que el header `Authorization`, así que contaminar el jar haría
 * fallar las peticiones posteriores con 403.
 */
export async function createSessionViaApi(
	_caller: APIRequestContext,
	page: Page | undefined,
	opts: CreateSessionOptions,
): Promise<AuthSession> {
	const password = opts.password ?? TEST_PASSWORD;
	const role = opts.role ?? "TEAM_DEVELOPER";
	const request = await playwrightRequest.newContext({ baseURL: BASE_ORIGIN });

	try {
		const registerRes = await request.post("/api/auth/register", {
			data: { name: opts.name, email: opts.email, password },
		});

		let userId = "";
		let sessionRole = "TEAM_DEVELOPER";

		if (registerRes.ok()) {
			const registered = (await registerRes.json()) as {
				user?: { id: string; role: string };
			};
			userId = registered.user?.id ?? "";
			sessionRole = registered.user?.role ?? "TEAM_DEVELOPER";
		} else {
			// El email ya existe (mismo uniqueId en varios tests): iniciar sesión.
			const existing = await doLogin(request, opts.email, password);
			if (!existing.ok) {
				throw new Error(
					`No se pudo registrar ni iniciar sesión ${opts.email}. Status: ${registerRes.status()} ${JSON.stringify(await registerRes.json())}`,
				);
			}
			userId = existing.user?.id ?? "";
			sessionRole = existing.user?.role ?? sessionRole;
		}

		if (role !== sessionRole) {
			await promoteRole(request, userId, role);
			sessionRole = role;
		}

		const login = await doLogin(request, opts.email, password);
		if (!login.ok || !login.token) {
			throw new Error(`Login final failed for ${opts.email}. Status: ${login.error}`);
		}

		const session: AuthSession = {
			id: login.user?.id ?? userId,
			email: opts.email,
			name: opts.name,
			role: sessionRole,
			token: login.token,
		};

		if (page) {
			await injectBrowserSession(
				page,
				{
					id: session.id,
					email: session.email,
					name: session.name,
					role: session.role,
				},
				session.token,
			);
		}

		return session;
	} finally {
		await request.dispose();
	}
}

/**
 * Sustituye la sesión del navegador (cookie httpOnly + `localStorage.user`).
 * El token viaja únicamente en la cookie: no se escribe en `localStorage`.
 */
export async function switchBrowserSession(
	page: Page,
	user: { id: string; email: string; name: string; role: string },
	token: string,
): Promise<void> {
	await injectBrowserSession(page, user, token);
}

/**
 * Fachada con argumentos posicionales Flexible sobre `createSessionViaApi`.
 *
 * Acepta dos formas:
 *   loginViaApi(page | request, email, password?, name?, role?)
 *   loginViaApi(page, request, email, role?, name?)   // overload legacy
 *
 * El contexto HTTP recibido se ignora a propósito: el flujo de auth corre
 * aislado para no dejar una cookie de sesión espuria en el jar compartido
 * (el middleware lee la cookie antes que el header `Authorization`, así que una
 * cookie de otro usuario haría fallar las llamadas siguientes con 403).
 */
export async function loginViaApi(
	ctx: APIRequestContext | Page,
	arg2?: string | APIRequestContext,
	arg3?: string,
	arg4?: string,
	arg5?: string,
): Promise<AuthSession> {
	let page: Page | undefined;

	let email = `user${Date.now()}@example.com`;
	let password = TEST_PASSWORD;
	let name = "Test User";
	let role: Role = "TEAM_DEVELOPER";

	// --- 1. Determine Page & arguments ---
	if ("goto" in ctx) {
		page = ctx as Page;

		if (arg2 && typeof arg2 !== "string" && "post" in arg2) {
			// loginViaApi(page, request, email, role|?, name?)
			if (arg3) email = arg3;
			if (arg4) {
				if (ROLES.includes(arg4)) {
					role = arg4 as Role;
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
			if (arg5) role = arg5 as Role;
		}
	} else {
		if (arg2 && typeof arg2 === "string") email = arg2;
		if (arg3) password = arg3;
		if (arg4) name = arg4;
		if (arg5) role = arg5 as Role;
	}

	// --- 2. Shortcuts a cuentas sembradas ---
	if (email === "admin" || email === "docente") {
		email = SEEDED_ADMIN_EMAIL;
		password = SEEDED_ADMIN_PASSWORD;
		role = "ADMIN";
	} else if (email === "student") {
		email = SEEDED_DEV_EMAIL;
		password = SEEDED_DEV_PASSWORD;
		role = "TEAM_DEVELOPER";
	} else if (!email.includes("@")) {
		email = `${email}@example.com`;
	}

	// --- 3. Registro + promoción + login (contexto aislado) ---
	const session = await createSessionViaApi(ctx as APIRequestContext, page, {
		name,
		email,
		password,
		role,
	});

	return session;
}