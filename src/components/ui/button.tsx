import type React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children: React.ReactNode;
	variant?: "default" | "ghost" | "outline";
	size?: "default" | "sm" | "lg" | "icon";
}

export function Button({
	children,
	variant = "default",
	size = "default",
	className = "",
	...props
}: ButtonProps) {
	const baseClasses =
		"inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50";

	const variantClasses = {
		default: "bg-blue-950 text-white hover:bg-blue-900",
		ghost:
			"border border-gray-400 text-black hover:bg-gray-100 hover:text-gray-900",
		outline:
			"border border-gray-400 text-black hover:bg-gray-100 hover:text-gray-900",
	};

	const sizeClasses = {
		default: "h-10 px-4 py-2",
		sm: "h-8 px-3 text-sm",
		lg: "h-12 px-6 text-lg",
		icon: "h-10 w-10",
	};

	const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

	return (
		<button className={classes} {...props}>
			{children}
		</button>
	);
}
