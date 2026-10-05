/**
 * Generación del CSV de exportación de proyecto (HU-14 · RNF7.2).
 *
 * Funciones puras: no dependen de Prisma ni de Express, de modo que el formato
 * del archivo se verifica con tests unitarios sin levantar servidor ni base de
 * datos. El aplanado de sprints y tareas a filas vive en la ruta, donde sí se
 * conoce la forma de la consulta; aquí solo se decide cómo se escribe una fila.
 */

/** Cabecera del archivo. Es contrato con el entregable (Tabla 28 + columna Puntos). */
export const PROJECT_REPORT_HEADER =
	"Sprint,Tarea,Asignado,Estado,Prioridad,Puntos";

/** Caracteres con los que una hoja de cálculo interpretaría el valor como fórmula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r", "\n"];

/**
 * Marca U+FEFF. Sin él, Excel en Windows abre el archivo como ANSI y destroza
 * tildes y "ñ", que es justo el dato que el docente exporta para un informe
 * oficial. No añade columnas: es el único byte previo a la cabecera.
 */
export const UTF8_BOM = "\uFEFF";

/** Nombre de archivo descargable de la exportación de un proyecto. */
export function projectReportFileName(projectId: string): string {
	return `project-${projectId}-report.csv`;
}

export interface ProjectReportRow {
	sprint: string;
	title: string;
	assignee: string;
	status: string;
	priority: string;
	points: string;
}

/**
 * Escapa una celda según RFC 4180.
 *
 * El orden de las dos transformaciones es deliberado y no debe invertirse:
 * primero se neutraliza la inyección de fórmulas (que decide por el primer
 * carácter del valor) y después se aplica el escapado CSV (que añade las
 * comillas). Sanitizar después de entrecomillar dejaría el apóstrofo de
 * protección fuera del campo que debe contenerlo.
 *
 * Todo valor se entrecomilla, sin excepción: es lo que garantiza que ninguna
 * coma, comilla doble o salto de línea parta una fila en columnas extra.
 */
export function escapeCsvCell(value: string): string {
	const dangerous = FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix));
	const sanitized = dangerous ? `'${value}` : value;
	return `"${sanitized.replace(/"/g, '""')}"`;
}

/**
 * Construye el archivo completo: BOM, cabecera y una línea por fila.
 *
 * Las filas llegan ya aplanadas; el módulo no conoce la estructura anidada de
 * Prisma. Un proyecto sin sprints produce un archivo con la cabecera y nada
 * más, que es el caso EXP-01.
 */
export function buildProjectReportCsv(rows: ProjectReportRow[]): string {
	const lines = rows.map((row) =>
		[
			escapeCsvCell(row.sprint),
			escapeCsvCell(row.title),
			escapeCsvCell(row.assignee),
			escapeCsvCell(row.status),
			escapeCsvCell(row.priority),
			escapeCsvCell(row.points),
		].join(","),
	);

	return [UTF8_BOM + PROJECT_REPORT_HEADER, ...lines].join("\n");
}
