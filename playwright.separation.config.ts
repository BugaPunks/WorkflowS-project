import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const BASE_ORIGIN = "http://localhost:3000";
const API_ORIGIN = "http://localhost:5000";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: "list",
	use: {
		baseURL: BASE_ORIGIN,
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	webServer: [
		{
			command: "npx tsx src/server/index.ts",
			url: `${API_ORIGIN}/api/health`,
			reuseExistingServer: !process.env.CI,
			env: {
				DISABLE_RATE_LIMIT: "true",
				CORS_ORIGINS: "http://localhost:3000",
				PORT: "5000",
				API_PORT: "5000",
				UPLOADS_DIR: ".e2e-separation-uploads",
				DATABASE_URL:
				process.env.DATABASE_URL ||
				(() => {
					throw new Error(
						"DATABASE_URL es obligatoria para ejecutar las pruebas e2e (PostgreSQL).",
					);
				})(),
			},
			timeout: 120_000,
		},
		{
			command: "npx rsbuild dev",
			url: BASE_ORIGIN,
			reuseExistingServer: !process.env.CI,
			env: {
				PUBLIC_API_URL: "http://localhost:5000",
			},
			timeout: 120_000,
		},
	],
});
