import type { Request } from "express";

// Express strips the mount path, so inside `app.use("/api", ...)` the paths
// below are relative to `/api` (e.g. `/notifications/unread-count`).
const POLLING_GET_PATHS = [
	/^\/notifications$/,
	/^\/notifications\/unread-count$/,
	/^\/chat\/[^/]+\/messages$/,
	/^\/chat\/conversation\/[^/]+\/messages$/,
];

export function isPollingRequest(
	req: Pick<Request, "method" | "path">,
): boolean {
	if (req.method !== "GET") {
		return false;
	}
	return POLLING_GET_PATHS.some((pattern) => pattern.test(req.path));
}
