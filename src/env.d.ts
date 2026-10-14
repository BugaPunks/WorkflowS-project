/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
	/**
	 * Origen del API para despliegues con frontend y API en orígenes distintos.
	 * Vacío (o ausente) deja las peticiones en rutas relativas `/api`.
	 */
	readonly PUBLIC_API_URL?: string;
}

/**
 * Imports the SVG file as a React component.
 * @requires [@rsbuild/plugin-svgr](https://npmjs.com/package/@rsbuild/plugin-svgr)
 */
declare module "*.svg?react" {
	import type React from "react";
	const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
	export default ReactComponent;
}
