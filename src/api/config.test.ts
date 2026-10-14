import { describe, expect, it } from "vitest";
import {
	buildApiUrl,
	normalizeOrigin,
	resolveApiBaseUrl,
	resolveApiUrl,
} from "./config";

describe("frontend API client configuration", () => {
	it("normaliza el origen quitando barras finales", () => {
		expect(normalizeOrigin("https://api.dominio.test/")).toBe(
			"https://api.dominio.test",
		);
		expect(normalizeOrigin("https://api.dominio.test///")).toBe(
			"https://api.dominio.test",
		);
	});

	it("con un origen definido, la base queda prefijada por ese origen", () => {
		expect(resolveApiBaseUrl("https://api.dominio.test")).toBe(
			"https://api.dominio.test/api",
		);
	});

	it("sin origen, la base es la ruta relativa /api", () => {
		expect(resolveApiBaseUrl("")).toBe("/api");
		expect(resolveApiBaseUrl("   ")).toBe("/api");
	});

	it("una barra final en el origen no produce //api", () => {
		expect(resolveApiBaseUrl("https://api.dominio.test/")).toBe(
			"https://api.dominio.test/api",
		);
		expect(buildApiUrl("https://api.dominio.test/", "/users")).toBe(
			"https://api.dominio.test/api/users",
		);
	});

	it("construye la URL de la petición a partir del origen y el path", () => {
		expect(buildApiUrl("", "/users")).toBe("/api/users");
		expect(buildApiUrl("https://api.dominio.test", "/chat/1/messages")).toBe(
			"https://api.dominio.test/api/chat/1/messages",
		);
	});

	it("resuelve las URLs de recursos servidos por el API contra su origen", () => {
		expect(resolveApiUrl("/api/files/123.pdf", "https://api.dominio.test")).toBe(
			"https://api.dominio.test/api/files/123.pdf",
		);
		expect(resolveApiUrl("/api/files/123.pdf", "")).toBe("/api/files/123.pdf");
		expect(
			resolveApiUrl("https://otros.test/api/files/1", "https://api.dominio.test"),
		).toBe("https://otros.test/api/files/1");
	});
});
