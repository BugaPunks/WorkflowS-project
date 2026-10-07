import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

// Docs: https://rsbuild.rs/config/
export default defineConfig({
	plugins: [pluginReact()],
	html: {
		title: "WorkflowS",
		favicon: "./public/favicon-w.png",
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:5000",
				changeOrigin: true,
				// Asegura que las rutas vayan con el prefijo /api al backend
				pathRewrite: { "^/api": "/api" },
			},
		},
	},
});
