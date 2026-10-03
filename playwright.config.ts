import { defineConfig, devices } from "@playwright/test";

const BASE_ORIGIN = "http://localhost:3000";
const API_ORIGIN = "http://localhost:5000";

export default defineConfig({
	testDir: "./e2e",
	// Data isolation per worker isn't implemented (we use a single dev.db),
	// so tests cannot run in parallel without colliding on data state.
	// NOTE: Because there is no cleanup step, dev.db accumulates test data
	// over consecutive test runs unless explicitly cleared.
	fullyParallel: false,
	// Fail the build on CI if you accidentally left test.only in the source code.
	forbidOnly: !!process.env.CI,
	// Retry on CI only
	retries: process.env.CI ? 2 : 0,
	// Opt out of parallel tests on CI.
	workers: 1,
	// Reporter to use. See https://playwright.dev/docs/test-reporters
	reporter: "list",
	use: {
		// Base URL to use in actions like `await page.goto('/')`.
		baseURL: BASE_ORIGIN,

		// Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Arranca la app y la API para los tests. El limitador de login (5 intentos
	// por 15 min) se desactiva porque la suite crea muchas sesiones.
	webServer: [
		{
			command: "npx tsx src/server/index.ts",
			url: `${API_ORIGIN}/api/health`,
			reuseExistingServer: !process.env.CI,
			env: {
				DISABLE_RATE_LIMIT: "true",
				DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
			},
			timeout: 120_000,
		},
		{
			command: "npx rsbuild dev",
			url: BASE_ORIGIN,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
	],
});
