import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, __resetPrisma } = vi.hoisted(() => {
	// El secreto y el backend se fijan AQUÍ porque `vi.hoisted` se ejecuta antes
	// que cualquier import: el middleware de auth lanza sin JWT_SECRET y el
	// backend de escritura se resuelve una sola vez al importar el módulo.
	process.env.JWT_SECRET = "test-secret-key-0123456789abcdef-0123456789";
	process.env.STORAGE_BACKEND = "disk";

	const prisma = {
		user: { findUnique: vi.fn() },
		projectMember: { findUnique: vi.fn() },
		document: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
		},
		documentFile: { findUnique: vi.fn(), update: vi.fn() },
	};

	return {
		prisma,
		__resetPrisma: () => {
			for (const delegate of Object.values(prisma)) {
				for (const fn of Object.values(delegate)) {
					fn.mockReset();
				}
			}
		},
	};
});

// Aislar la capa de datos: solo se mockea prisma; los middlewares auth y
// project-rbac se ejecutan REALES contra estos mocks.
vi.mock("../db", () => ({ prisma, default: prisma }));

import { JWT_AUDIENCE, JWT_ISSUER } from "../middleware/auth";
import { backendFor, resolveWriteBackend, writeBackend } from "../storage";
import { postgresStorage } from "../storage/postgres";
import documentsRouter from "./documents";
import filesRouter from "./files";

const TEST_JWT_SECRET =
	process.env.JWT_SECRET ?? "test-secret-key-0123456789abcdef-0123456789";

const PROJECT_ID = "proj-1";
const USER_ID = "user-1";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

let server: Server;
let baseUrl: string;
let tmpUploadsDir: string;

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use("/api/documents", documentsRouter);
	app.use("/api/files", filesRouter);
	await new Promise<void>((resolve) => {
		server = app.listen(0, () => resolve());
	});
	const address = server.address();
	if (address && typeof address === "object") {
		baseUrl = `http://127.0.0.1:${address.port}`;
	}
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) =>
		server.close((err) => (err ? reject(err) : resolve())),
	);
});

beforeEach(() => {
	__resetPrisma();
	// Directorio temporal propio por prueba: el backend de disco lo lee en cada
	// uso, así que basta con apuntarlo aquí.
	tmpUploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "workflows-uploads-"));
	process.env.UPLOADS_DIR = tmpUploadsDir;

	mockUser("TEAM_DEVELOPER");
	mockMembership("TEAM_DEVELOPER");
});

afterEach(() => {
	fs.rmSync(tmpUploadsDir, { recursive: true, force: true });
});

const signToken = (role: string, userId: string = USER_ID): string =>
	jwt.sign({ userId, email: "test@example.com", role, v: 0 }, TEST_JWT_SECRET, {
		algorithm: "HS256",
		issuer: JWT_ISSUER,
		audience: JWT_AUDIENCE,
	});

const authHeaders = (role = "TEAM_DEVELOPER"): Record<string, string> => ({
	Authorization: `Bearer ${signToken(role)}`,
});

const mockUser = (role: string) =>
	prisma.user.findUnique.mockResolvedValue({
		id: USER_ID,
		email: "test@example.com",
		role,
		active: true,
		tokenVersion: 0,
	});

const mockMembership = (role: string | null) =>
	prisma.projectMember.findUnique.mockResolvedValue(
		role ? { id: "m-1", projectId: PROJECT_ID, userId: USER_ID, role } : null,
	);

/** Sube un archivo por multipart, igual que el frontend. */
const uploadDocument = (
	options: {
		filename?: string;
		mimeType?: string;
		content?: Buffer;
		roles?: string;
		path?: string;
	} = {},
): Promise<Response> => {
	const {
		filename = "informe.pdf",
		mimeType = "application/pdf",
		content = Buffer.from("contenido de prueba"),
		roles = "TEAM_DEVELOPER",
		path: requestPath = `/api/documents/${PROJECT_ID}`,
	} = options;

	const form = new FormData();
	form.append(
		"file",
		// Copia a un Uint8Array propio para satisfacer `BlobPart` (el Buffer de
		// Node puede tener un ArrayBuffer compartido).
		new Blob([new Uint8Array(content)], { type: mimeType }),
		filename,
	);

	return fetch(`${baseUrl}${requestPath}`, {
		method: "POST",
		headers: authHeaders(roles),
		body: form,
	});
};

/** Registro de archivo como lo devuelve Prisma al buscar por clave. */
const fileRow = (overrides: Record<string, unknown> = {}) => ({
	id: "file-1",
	key: "archivo.pdf",
	backend: "disk",
	mimeType: "application/pdf",
	size: 12,
	data: null,
	documentId: "doc-1",
	document: { id: "doc-1", projectId: PROJECT_ID, name: "Informe final.pdf" },
	...overrides,
});

describe("Subida de documentos (backend de disco)", () => {
	it("guarda el archivo, registra el backend y lo deja descargable", async () => {
		prisma.document.findFirst.mockResolvedValue(null);
		prisma.document.create.mockImplementation(async ({ data }) => ({
			id: "doc-1",
			...data,
		}));

		const res = await uploadDocument({ content: Buffer.from("hola mundo") });
		expect(res.status).toBe(201);

		const created = prisma.document.create.mock.calls[0][0].data;
		expect(created.file.create.backend).toBe("disk");
		expect(created.url).toMatch(/^\/api\/files\/\d+-\d+-informe\.pdf$/);

		// El archivo quedó en el directorio configurado, con el contenido íntegro.
		const key = created.file.create.key;
		expect(fs.readFileSync(path.join(tmpUploadsDir, key)).toString()).toBe(
			"hola mundo",
		);
	});

	it("reduce el nombre original a caracteres seguros para la URL", async () => {
		prisma.document.findFirst.mockResolvedValue(null);
		prisma.document.create.mockImplementation(async ({ data }) => ({
			id: "doc-1",
			...data,
		}));

		const res = await uploadDocument({ filename: "acta #2 (final).pdf" });
		expect(res.status).toBe(201);

		const created = prisma.document.create.mock.calls[0][0].data;
		expect(created.file.create.key).not.toMatch(/[ #()]/);
		// El nombre real se conserva para la descarga.
		expect(created.name).toBe("acta #2 (final).pdf");
	});

	it("rechaza con 415 un tipo no permitido y no crea documento", async () => {
		const res = await uploadDocument({
			filename: "script.js",
			mimeType: "application/javascript",
		});

		expect(res.status).toBe(415);
		expect(prisma.document.create).not.toHaveBeenCalled();
	});

	it("rechaza con 413 un archivo que excede el límite y no crea documento", async () => {
		const res = await uploadDocument({
			content: Buffer.alloc(MAX_FILE_SIZE + 1),
		});

		expect(res.status).toBe(413);
		expect(prisma.document.create).not.toHaveBeenCalled();
	});

	it("revierte el documento si falla el guardado de los bytes", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		prisma.document.findFirst.mockResolvedValue(null);
		prisma.document.create.mockImplementation(async ({ data }) => ({
			id: "doc-1",
			...data,
		}));
		prisma.document.delete.mockResolvedValue({ id: "doc-1" });
		// Directorio inexistente: la escritura falla.
		process.env.UPLOADS_DIR = path.join(tmpUploadsDir, "no-existe");

		const res = await uploadDocument();

		expect(res.status).toBe(500);
		expect(prisma.document.delete).toHaveBeenCalledWith({
			where: { id: "doc-1" },
		});
		errorSpy.mockRestore();
	});
});

describe("Descarga de documentos y autorización", () => {
	it("401 sin sesión", async () => {
		const res = await fetch(`${baseUrl}/api/files/archivo.pdf`);
		expect(res.status).toBe(401);
	});

	it("403 para un usuario que no pertenece al proyecto", async () => {
		prisma.documentFile.findUnique.mockResolvedValue(fileRow());
		mockMembership(null);

		const res = await fetch(`${baseUrl}/api/files/archivo.pdf`, {
			headers: authHeaders(),
		});
		expect(res.status).toBe(403);
	});

	it("200 para un miembro, con los bytes y el tipo registrado", async () => {
		const key = "123-456-informe.pdf";
		fs.writeFileSync(path.join(tmpUploadsDir, key), "bytes guardados");
		prisma.documentFile.findUnique.mockResolvedValue(
			fileRow({ key, size: 14, mimeType: "application/pdf" }),
		);

		const res = await fetch(`${baseUrl}/api/files/${key}`, {
			headers: authHeaders(),
		});

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/pdf");
		expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(
			"bytes guardados",
		);
	});

	it("200 para un administrador sin pertenencia al proyecto", async () => {
		const key = "123-456-admin.pdf";
		fs.writeFileSync(path.join(tmpUploadsDir, key), "bytes");
		prisma.documentFile.findUnique.mockResolvedValue(fileRow({ key }));
		prisma.projectMember.findUnique.mockResolvedValue(null);
		// El rol efectivo lo aporta la fila del usuario, no el token.
		mockUser("ADMIN");

		const res = await fetch(`${baseUrl}/api/files/${key}`, {
			headers: authHeaders("ADMIN"),
		});

		expect(res.status).toBe(200);
		expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
	});

	it("404 para una clave inexistente", async () => {
		prisma.documentFile.findUnique.mockResolvedValue(null);

		const res = await fetch(`${baseUrl}/api/files/no-existe.pdf`, {
			headers: authHeaders(),
		});
		expect(res.status).toBe(404);
	});

	it("404 cuando el registro declara disco y el archivo ya no está", async () => {
		prisma.documentFile.findUnique.mockResolvedValue(
			fileRow({ key: "desaparecido.pdf" }),
		);

		const res = await fetch(`${baseUrl}/api/files/desaparecido.pdf`, {
			headers: authHeaders(),
		});
		expect(res.status).toBe(404);
	});
});

describe("Borrado de documentos", () => {
	it("elimina los bytes del disco y luego el documento", async () => {
		const key = "123-456-borrar.pdf";
		fs.writeFileSync(path.join(tmpUploadsDir, key), "bytes");

		// La misma consulta resuelve el proyecto (para el RBAC) y el archivo.
		prisma.document.findUnique.mockResolvedValue({
			projectId: PROJECT_ID,
			file: { key, backend: "disk" },
		});
		prisma.document.delete.mockResolvedValue({ id: "doc-1" });
		mockMembership("PRODUCT_OWNER");
		mockUser("PRODUCT_OWNER");

		const res = await fetch(`${baseUrl}/api/documents/doc-1`, {
			method: "DELETE",
			headers: authHeaders("PRODUCT_OWNER"),
		});

		expect(res.status).toBe(200);
		expect(fs.existsSync(path.join(tmpUploadsDir, key))).toBe(false);
		expect(prisma.document.delete).toHaveBeenCalledWith({
			where: { id: "doc-1" },
		});
	});
});

describe("Backend de Postgres", () => {
	it("guarda los bytes en la fila del archivo", async () => {
		prisma.documentFile.update.mockResolvedValue({ id: "file-1" });

		await postgresStorage.save({
			key: "123-456-informe.pdf",
			data: Buffer.from("bytes en la base"),
		});

		const call = prisma.documentFile.update.mock.calls[0][0];
		expect(call.where).toEqual({ key: "123-456-informe.pdf" });
		expect(Buffer.from(call.data.data).toString()).toBe("bytes en la base");
	});

	it("devuelve los bytes de la fila y null si no están", async () => {
		const bytes = new Uint8Array(Buffer.from("bytes en la base"));
		const withData = await postgresStorage.read({
			key: "k",
			backend: "postgres",
			data: bytes,
		});
		expect(withData?.toString()).toBe("bytes en la base");

		const withoutData = await postgresStorage.read({
			key: "k",
			backend: "postgres",
			data: null,
		});
		expect(withoutData).toBeNull();
	});

	it("resuelve el backend de escritura desde la configuración", () => {
		expect(resolveWriteBackend("postgres").name).toBe("postgres");
		expect(resolveWriteBackend("disk").name).toBe("disk");
		// Sin variable y con un valor desconocido cae en el disco.
		expect(resolveWriteBackend(undefined).name).toBe("disk");
		expect(resolveWriteBackend("almacenamiento-inventado").name).toBe("disk");
	});

	it("resuelve el backend de lectura por el nombre persistido", () => {
		expect(backendFor("postgres").name).toBe("postgres");
		expect(backendFor("disk").name).toBe("disk");
		// Un registro con un backend desconocido no rompe la descarga.
		expect(backendFor("inventado").name).toBe("disk");
	});

	it("el backend de escritura del entorno de pruebas es el de disco", () => {
		expect(writeBackend.name).toBe("disk");
	});
});
