import type React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?:
		| "default"
		| "primary"
		| "secondary"
		| "danger"
		| "ghost"
		| "outline";
	size?: "default" | "sm" | "lg" | "icon";
}

export function Button({
	variant = "default",
	className,
	size = "default",
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95",
				// Size Styles
				{
					"h-10 px-4 py-2": size === "default",
					"h-8 px-3 text-xs": size === "sm",
					"h-12 px-6 text-base": size === "lg",
					"h-10 w-10 p-2": size === "icon",
				},
				// Variant Styles
				{
					"bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900 shadow-sm":
						variant === "default" || variant === "outline",
					"bg-blue-950 text-white hover:bg-blue-900 shadow-md hover:shadow-lg shadow-blue-700/20 border border-transparent":
						variant === "primary",
					"bg-gray-100 text-gray-900 hover:bg-gray-200 border border-transparent":
						variant === "secondary",
					"bg-red-50 text-red-600 hover:bg-red-100 border border-transparent":
						variant === "danger",
					"bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900":
						variant === "ghost",
				},
				className,
			)}
			{...props}
		/>
	);
}
