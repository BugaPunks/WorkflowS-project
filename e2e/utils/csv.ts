/**
 * Utilidades de CSV para los tests de exportación (HU-14 · RNF7.2).
 *
 * El archivo que produce la API empieza con el BOM UTF-8 (U+FEFF) para que
 * Excel en Windows no destroce las tildes. `TextDecoder` —y por tanto
 * `response.text()`— ya lo consume al decodificar, pero un `Buffer` o una
 * lectura por bytes lo conservan. Por eso el BOM se retira SOLO si está
 * presente: un `slice(1)` incondicional truncaría el primer carácter de la
 * cabecera en el caso de que el cliente ya lo hubiera eliminado.
 */

/** Cabecera del archivo, sin BOM. Es el contrato de la Tabla 28 + columna Puntos. */
export const PROJECT_REPORT_HEADER =
	"Sprint,Tarea,Asignado,Estado,Prioridad,Puntos";

/** Marca de orden de bytes UTF-8 que precede a la cabecera del archivo. */
export const UTF8_BOM = "\uFEFF";

/** Cabecera como la emite `buildProjectReportCsv`: el BOM precede al primer campo. */
export const PROJECT_REPORT_HEADER_WITH_BOM = `${UTF8_BOM}${PROJECT_REPORT_HEADER}`;

/** Retira el BOM UTF-8 si está presente; si no, devuelve el texto intacto. */
export function stripBom(text: string): string {
	return text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
}

/**
 * Parser RFC 4180: devuelve una matriz de filas, cada una con sus campos ya
 * desentrecomillados y con las comillas dobles internas colapsadas.
 *
 * Existe para poder afirmar "esta fila tiene exactamente 6 columnas" sobre el
 * archivo real, que es la propiedad que el escapado debe garantizar. Al
 * entrecomillar siempre todos los valores, un fallo de escapado se manifiesta
 * como una fila con más campos, que es exactamente lo que este parser delata.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				// "" dentro de un campo entrecomillado es una comilla literal.
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
		} else if (char !== "\r") {
			field += char;
		}
	}

	// Última fila sin salto de línea final.
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

/** Divide el archivo en su cabecera y sus filas de datos, ya parseadas. */
export function parseProjectReport(text: string): {
	header: string[];
	rows: string[][];
} {
	const all = parseCsv(stripBom(text));
	return { header: all[0] ?? [], rows: all.slice(1) };
}
