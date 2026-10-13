import { expect, request as playwrightRequest, test } from "@playwright/test";
import {
	BASE_ORIGIN,
	loginViaApi,
	TEST_PASSWORD,
} from "./utils/api-auth";

test.describe("Chat DM hardening — autorización", () => {
	test("conversación por id es fail-closed y 'mis chats' usa la identidad del JWT", async ({
		request,
	}) => {
		const timestamp = Date.now();

		const alice = await loginViaApi(
			request,
			`authz_a_${timestamp}@test.com`,
			TEST_PASSWORD,
			`Authz A ${timestamp}`,
			"TEAM_DEVELOPER",
		);
		const bob = await loginViaApi(
			request,
			`authz_b_${timestamp}@test.com`,
			TEST_PASSWORD,
			`Authz B ${timestamp}`,
			"TEAM_DEVELOPER",
		);
		const mallory = await loginViaApi(
			request,
			`authz_c_${timestamp}@test.com`,
			TEST_PASSWORD,
			`Authz C ${timestamp}`,
			"TEAM_DEVELOPER",
		);
		const admin = await loginViaApi(
			request,
			`authz_admin_${timestamp}@test.com`,
			TEST_PASSWORD,
			`Authz Admin ${timestamp}`,
			"ADMIN",
		);

		// Contextos HTTP aislados por usuario: el middleware de auth lee la cookie
		// antes que el header Authorization, así que no se comparte jar de cookies.
		const aliceCtx = await playwrightRequest.newContext({
			baseURL: BASE_ORIGIN,
			extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
		});
		const malloryCtx = await playwrightRequest.newContext({
			baseURL: BASE_ORIGIN,
			extraHTTPHeaders: { Authorization: `Bearer ${mallory.token}` },
		});
		const adminCtx = await playwrightRequest.newContext({
			baseURL: BASE_ORIGIN,
			extraHTTPHeaders: { Authorization: `Bearer ${admin.token}` },
		});

		try {
			// 1. Alice crea un DM con Bob
			const dmRes = await aliceCtx.post("/api/chat/direct", {
				data: { targetUserId: bob.id },
			});
			expect(dmRes.status()).toBe(200);
			const dmBody = (await dmRes.json()) as { data: { id: string } };
			const chatId = dmBody.data.id;
			expect(chatId).toBeTruthy();

			// 2. Mallory (no participante) no puede leer ni escribir (fail-closed)
			const malloryGet = await malloryCtx.get(
				`/api/chat/conversation/${chatId}/messages`,
			);
			expect(malloryGet.status()).toBe(403);

			const malloryPost = await malloryCtx.post(
				`/api/chat/conversation/${chatId}/messages`,
				{ data: { content: "intento ajeno" } },
			);
			expect(malloryPost.status()).toBe(403);

			// 3. Participante puede leer y escribir
			const aliceGet = await aliceCtx.get(
				`/api/chat/conversation/${chatId}/messages`,
			);
			expect(aliceGet.status()).toBe(200);

			const alicePost = await aliceCtx.post(
				`/api/chat/conversation/${chatId}/messages`,
				{ data: { content: "Hola participante" } },
			);
			expect(alicePost.status()).toBe(201);

			// 4. ADMIN puede leer cualquier conversación (bypass explícito)
			const adminGet = await adminCtx.get(
				`/api/chat/conversation/${chatId}/messages`,
			);
			expect(adminGet.status()).toBe(200);

			// 5. Conversación inexistente → 404
			const notFound = await malloryCtx.get(
				"/api/chat/conversation/chat-does-not-exist/messages",
			);
			expect(notFound.status()).toBe(404);

			// 6. "Mis chats": mallory pide con el id de Alice en el path
			// → 200 y SIEMPRE sus propios chats (el parámetro se ignora para no-admin)
			const malloryChats = await malloryCtx.get(
				`/api/chat/user/${alice.id}/all`,
			);
			expect(malloryChats.status()).toBe(200);
			const malloryBody = (await malloryChats.json()) as {
				data: { id: string }[];
			};
			const malloryIds = malloryBody.data.map((c) => c.id);
			expect(malloryIds).not.toContain(chatId);

			// 7. ADMIN consulta los chats de Alice → el parámetro sí es efectivo
			const adminChats = await adminCtx.get(
				`/api/chat/user/${alice.id}/all`,
			);
			expect(adminChats.status()).toBe(200);
			const adminBody = (await adminChats.json()) as {
				data: { id: string }[];
			};
			expect(adminBody.data.map((c) => c.id)).toContain(chatId);
		} finally {
			await Promise.all([
				aliceCtx.dispose(),
				malloryCtx.dispose(),
				adminCtx.dispose(),
			]);
		}
	});
});