import { describe, expect, test } from "vitest";
import {
	buildProjectReportCsv,
	escapeCsvCell,
	PROJECT_REPORT_HEADER,
	type ProjectReportRow,
	projectReportFileName,
	UTF8_BOM,
} from "./csv";

const stripBom = (text: string) =>
	text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;

/** Parser RFC 4180 mínimo: sirve para comprobar que las filas tienen 6 columnas. */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}

	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

const row = (overrides: Partial<ProjectReportRow> = {}): ProjectReportRow => ({
	sprint: "Sprint 1",
	title: "Tarea",
	assignee: "Ada Lovelace",
	status: "TODO",
	priority: "HIGH",
	points: "N/A",
	...overrides,
});

describe("escapeCsvCell", () => {
	test("2.1 entrecomilla todo valor, incluidos los que no lo necesitan", () => {
		expect(escapeCsvCell("TODO")).toBe('"TODO"');
		expect(escapeCsvCell("Sin asignar")).toBe('"Sin asignar"');
	});

	test("2.1 duplica las comillas dobles internas", () => {
		expect(escapeCsvCell('Diseño "login"')).toBe('"Diseño ""login"""');
	});

	test("2.1 una coma no añade columnas porque el valor siempre va entrecomillado", () => {
		expect(escapeCsvCell("Sprint 1, Fase A")).toBe('"Sprint 1, Fase A"');
	});

	test("2.1 neutraliza la inyección de fórmulas anteponiendo un apóstrofo", () => {
		expect(escapeCsvCell("=SUM(A1:A9)")).toBe(`"'=SUM(A1:A9)"`);
		expect(escapeCsvCell("@import")).toBe(`"'@import"`);
		expect(escapeCsvCell("-Revisar")).toBe(`"'-Revisar"`);
	});

	test("2.1 la neutralización se decide por el inicio del valor, antes de entrecomillar", () => {
		expect(escapeCsvCell("Tarea = importante")).toBe('"Tarea = importante"');
	});

	test("2.1 un salto de línea queda dentro del campo y no crea una fila nueva", () => {
		expect(escapeCsvCell("linea 1\nlinea 2")).toBe('"linea 1\nlinea 2"');
	});
});

describe("buildProjectReportCsv", () => {
	test("2.2 un proyecto sin sprints produce solo la cabecera (EXP-01)", () => {
		const csv = buildProjectReportCsv([]);

		expect(stripBom(csv)).toBe(PROJECT_REPORT_HEADER);
		expect(parseCsv(stripBom(csv))).toHaveLength(1);
	});

	test("2.2 el archivo empieza por el BOM seguido de la cabecera", () => {
		const csv = buildProjectReportCsv([]);

		expect(csv.startsWith(UTF8_BOM)).toBe(true);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		expect(stripBom(csv).split("\n")).toHaveLength(1);
	});

	test("2.2 una fila por tarea, con el orden de columnas de la cabecera", () => {
		const csv = buildProjectReportCsv([
			row({ title: "Primera" }),
			row({ title: "Segunda" }),
		]);
		const rows = parseCsv(stripBom(csv));

		expect(rows).toHaveLength(3);
		expect(rows[0]).toEqual([
			"Sprint",
			"Tarea",
			"Asignado",
			"Estado",
			"Prioridad",
			"Puntos",
		]);
		expect(rows[1]).toEqual([
			"Sprint 1",
			"Primera",
			"Ada Lovelace",
			"TODO",
			"HIGH",
			"N/A",
		]);
		expect(rows[2][1]).toBe("Segunda");
	});

	test("2.2 EXP-02: tildes, comillas y comas round-trip sin romper las 6 columnas", () => {
		const tricky = row({
			sprint: "Sprint 1, Fase A",
			title: 'Diseño "login", con ácentos',
			assignee: "José Pérez, Jr",
		});
		const rows = parseCsv(stripBom(buildProjectReportCsv([tricky])));

		expect(rows).toHaveLength(2);
		expect(rows[1]).toHaveLength(6);
		expect(rows[1]).toEqual([
			"Sprint 1, Fase A",
			'Diseño "login", con ácentos',
			"José Pérez, Jr",
			"TODO",
			"HIGH",
			"N/A",
		]);
	});

	test("2.2 la eñe y los acentos sobreviven al round trip", () => {
		const rows = parseCsv(
			stripBom(
				buildProjectReportCsv([row({ title: "Añadir login año 2026" })]),
			),
		);

		expect(rows[1][1]).toBe("Añadir login año 2026");
	});

	test("2.2 un salto de línea en el título no fusiona las tareas siguientes", () => {
		const rows = parseCsv(
			stripBom(
				buildProjectReportCsv([
					row({ title: "Primera parte\nsegunda parte" }),
					row({ title: "Tarea posterior" }),
				]),
			),
		);

		expect(rows).toHaveLength(3);
		expect(rows[1][1]).toBe("Primera parte\nsegunda parte");
		expect(rows[2][1]).toBe("Tarea posterior");
	});

	test("2.2 sin asignar y N/A se escriben literalmente", () => {
		const rows = parseCsv(
			stripBom(
				buildProjectReportCsv([
					row({ assignee: "Sin asignar", points: "N/A" }),
				]),
			),
		);

		expect(rows[1][2]).toBe("Sin asignar");
		expect(rows[1][5]).toBe("N/A");
	});

	test("2.2 toda fila de datos tiene exactamente 6 columnas con cualquier contenido", () => {
		const hostile = [
			row({ sprint: 'a,"b', title: "c\nd", assignee: "e,f", status: "g;h" }),
			row({ sprint: "", title: "", assignee: "", status: "", priority: "" }),
			row({ title: "=CMD|calc", priority: "-1" }),
		];
		const rows = parseCsv(stripBom(buildProjectReportCsv(hostile)));

		for (const parsed of rows) {
			expect(parsed).toHaveLength(6);
		}
	});
});

describe("constantes del archivo", () => {
	test("2.3 la cabecera es la de la Tabla 28 más la columna Puntos", () => {
		expect(PROJECT_REPORT_HEADER).toBe(
			"Sprint,Tarea,Asignado,Estado,Prioridad,Puntos",
		);
	});

	test("2.3 el nombre de archivo sigue el patrón project-{id}-report.csv", () => {
		expect(projectReportFileName("abc123")).toBe("project-abc123-report.csv");
	});
});

describe("el escapado es lo que hace correctas las filas", () => {
	test("2.5 el formato anterior, sin duplicar comillas ni entrecomillar todo, rompe la fila", () => {
		const sanitizeOld = (value: string) =>
			["=", "+", "-", "@", "\t", "\n"].some((c) => value.startsWith(c))
				? `'${value}`
				: value;
		const legacyRow = `${sanitizeOld("Sprint 1, Fase A")},"${sanitizeOld(
			'Diseño "login", con ácentos',
		)}",${sanitizeOld("José Pérez, Jr")},TODO,HIGH,N/A`;

		// La fila que produce el formato anterior no parsea en 6 columnas, que es
		// exactamente el defecto que estos tests impiden reintroducir.
		expect(legacyRow.split(",").length).toBeGreaterThan(6);

		const rows = parseCsv(
			stripBom(
				buildProjectReportCsv([row({ title: 'Diseño "login", con ácentos' })]),
			),
		);
		expect(rows[1]).toHaveLength(6);
	});
});
