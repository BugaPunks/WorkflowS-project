/**
 * Configuración del cliente API.
 *
 * El frontend puede desplegarse en un origen distinto del API. El origen se
 * resuelve en tiempo de build a partir de la variable pública `PUBLIC_API_URL`
 * (Rsbuild expone a `import.meta.env` toda variable de `process.env` con ese
 * prefijo). Sin la variable se usan rutas relativas `/api`, que el proxy de
 * Rsbuild resuelve en desarrollo.
 */

/** Normaliza un origen quitando barras finales para no generar `//api`. */
export const normalizeOrigin = (origin: string): string =>
	origin.replace(/\/+$/, "");

/** URL base de las peticiones al API (`<origen>/api` o `/api`). */
export const resolveApiBaseUrl = (origin: string): string => {
	const normalized = normalizeOrigin(origin.trim());
	return normalized ? `${normalized}/api` : "/api";
};

/** Construye la URL de una petición del API a partir del origen y el path. */
export const buildApiUrl = (origin: string, path: string): string =>
	`${resolveApiBaseUrl(origin)}${path}`;

/** Origen del API configurado en build (vacío si no se definió). */
export const API_ORIGIN = normalizeOrigin(import.meta.env.PUBLIC_API_URL ?? "");

/** Base de las peticiones al API para el origen configurado. */
export const API_BASE_URL = resolveApiBaseUrl(API_ORIGIN);

/**
 * Convierte una URL relativa del API (`/api/files/...`) en absoluta contra el
 * origen configurado. Las URLs absolutas y el caso sin origen se devuelven tal cual.
 */
export const resolveApiUrl = (
	url: string,
	origin: string = API_ORIGIN,
): string => {
	const normalized = normalizeOrigin(origin.trim());
	if (!normalized || /^https?:\/\//i.test(url)) return url;
	return url.startsWith("/") ? `${normalized}${url}` : `${normalized}/${url}`;
};

/**
 * Realiza una petición al API: prefija la base, incluye credenciales de sesión
 * y deja intactas las cabeceras y el cuerpo para no romper `FormData` ni el
 * manejo de `Response` existente.
 */
export const apiFetch = (
	path: string,
	options: RequestInit = {},
): Promise<Response> =>
	fetch(`${API_BASE_URL}${path}`, {
		...options,
		credentials: "include",
	});
