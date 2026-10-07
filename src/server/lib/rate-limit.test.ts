import { describe, expect, test } from "vitest";
import { isPollingRequest } from "./rate-limit";

const request = (method: string, path: string) => ({ method, path });

describe("isPollingRequest", () => {
	test.each([
		"/notifications",
		"/notifications/unread-count",
		"/chat/project-123/messages",
		"/chat/conversation/chat-456/messages",
	])("returns true for GET %s", (path) => {
		expect(isPollingRequest(request("GET", path))).toBe(true);
	});

	test.each([
		"/notifications",
		"/notifications/unread-count",
		"/chat/project-123/messages",
		"/chat/conversation/chat-456/messages",
	])("returns false for non-GET on %s", (path) => {
		expect(isPollingRequest(request("POST", path))).toBe(false);
	});

	test.each([
		"/notifications/123",
		"/chat/abc/messages/extra",
		"/projects",
		"/tasks",
	])("returns false for non-exempt GET %s", (path) => {
		expect(isPollingRequest(request("GET", path))).toBe(false);
	});
});
