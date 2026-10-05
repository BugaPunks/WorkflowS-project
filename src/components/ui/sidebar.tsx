import type React from "react";
import { useSidebar } from "../../islands/SidebarProvider";
import { PanelLeftIcon } from "./icons/PanelLeftIcon";

// Constantes
const SIDEBAR_WIDTH_MOBILE = "18rem";

// Componente Sidebar
export function Sidebar({
	side = "left",
	variant = "sidebar",
	collapsible = "offcanvas",
	className = "",
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement> & {
	side?: "left" | "right";
	variant?: "sidebar" | "floating" | "inset";
	collapsible?: "offcanvas" | "icon" | "none";
}) {
	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	if (collapsible === "none") {
		return (
			<div
				data-slot="sidebar"
				className={`bg-sidebar text-sidebar-foreground flex h-full w-[var(--sidebar-width)] flex-col ${className}`}
				{...props}
			>
				{children}
			</div>
		);
	}

	if (isMobile) {
		return (
			<div
				className={`${openMobile ? "block" : "hidden"} fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm`}
				onClick={() => setOpenMobile(false)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						setOpenMobile(false);
					}
				}}
				role="dialog"
				aria-modal="true"
				aria-label="Menú lateral"
			>
				<div
					data-sidebar="sidebar"
					data-slot="sidebar"
					data-mobile="true"
					className="bg-white text-gray-800 w-[var(--sidebar-width)] h-full p-0 fixed"
					style={
						{
							"--sidebar-width": SIDEBAR_WIDTH_MOBILE,
						} as React.CSSProperties
					}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
					role="dialog"
					aria-modal="true"
					aria-label="Sidebar móvil"
				>
					<div className="flex h-full w-full flex-col">{children}</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className="group peer text-gray-800 hidden lg:block"
			data-state={state}
			data-collapsible={collapsible}
			data-variant={variant}
			data-side={side}
			data-slot="sidebar"
		>
			{/* Maneja el espacio del sidebar en desktop */}
			<div
				className={`relative h-screen w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear
          group-data-[collapsible=offcanvas]:w-0
          group-data-[side=right]:rotate-180
          ${
						variant === "floating" || variant === "inset"
							? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
							: "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]"
					}`}
			/>
			<div
				className={`fixed inset-y-0 z-10 hidden h-screen w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear lg:flex
          ${
						side === "left"
							? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
							: "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]"
					}
          ${
						variant === "floating" || variant === "inset"
							? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
							: "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)] group-data-[side=left]:border-r group-data-[side=right]:border-l"
					}
          ${className}`}
				{...props}
			>
				<div
					data-sidebar="sidebar"
					className="bg-white group-data-[variant=floating]:border-gray-200 flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
				>
					{children}
				</div>
			</div>
		</div>
	);
}

// Componente SidebarTrigger
export function SidebarTrigger({
	className = "",
	onClick,
	...props
}: React.HTMLAttributes<HTMLButtonElement>) {
	const { toggleSidebar } = useSidebar();

	// Convertir className a string
	const classStr =
		typeof className === "string" ? className : String(className || "");

	return (
		<button
			type="button"
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			className={`inline-flex items-center justify-center rounded-md h-7 w-7 p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors ${classStr}`}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<PanelLeftIcon />
			<span className="sr-only">Toggle Sidebar</span>
		</button>
	);
}

// Componente SidebarHeader
export function SidebarHeader({
	className = "",
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={`flex flex-col gap-2 p-2 ${className}`}
			{...props}
		/>
	);
}

// Componente SidebarContent
export function SidebarContent({
	className = "",
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={`flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden ${className}`}
			{...props}
		/>
	);
}

// Componente SidebarFooter
export function SidebarFooter({
	className = "",
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={`flex flex-col gap-2 p-2 ${className}`}
			{...props}
		/>
	);
}

// Componente SidebarMenu
export function SidebarMenu({
	className = "",
	...props
}: React.HTMLAttributes<HTMLUListElement>) {
	return (
		<ul
			data-slot="sidebar-menu"
			data-sidebar="menu"
			className={`flex w-full min-w-0 flex-col gap-1 ${className}`}
			{...props}
		/>
	);
}

// Componente SidebarMenuItem
export function SidebarMenuItem({
	className = "",
	...props
}: React.HTMLAttributes<HTMLLIElement>) {
	return (
		<li
			data-slot="sidebar-menu-item"
			data-sidebar="menu-item"
			className={`group/menu-item relative ${className}`}
			{...props}
		/>
	);
}

// Componente SidebarMenuButton
export function SidebarMenuButton({
	isActive = false,
	variant: _variant = "default",
	size: sizeParam,
	className = "",
	...props
}: React.HTMLAttributes<HTMLButtonElement> & {
	isActive?: boolean;
	variant?: "default" | "outline";
	size?: "default" | "sm" | "lg";
}) {
	const size = sizeParam || "default";

	const sizeClasses: Record<string, string> = {
		default: "h-8 text-sm",
		sm: "h-7 text-xs",
		lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
	};

	const classStr =
		typeof className === "string" ? className : String(className || "");
	const sizeClass = sizeClasses[size] || sizeClasses.default;

	return (
		<button
			data-slot="sidebar-menu-button"
			data-sidebar="menu-button"
			data-size={size}
			data-active={isActive}
			className={`peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 active:bg-gray-100 active:text-gray-900 disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-gray-100 data-[active=true]:font-medium data-[active=true]:text-gray-900 data-[state=open]:hover:bg-gray-100 data-[state=open]:hover:text-gray-900 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 ${sizeClass} ${classStr}`}
			{...props}
		/>
	);
}

// Componente SidebarGroup
export function SidebarGroup({
	className = "",
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="sidebar-group"
			data-sidebar="group"
			className={`relative flex w-full min-w-0 flex-col p-2 ${className}`}
			{...props}
		/>
	);
}

// Componente SidebarGroupLabel
export function SidebarGroupLabel({
	className = "",
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="sidebar-group-label"
			data-sidebar="group-label"
			className={`text-gray-500 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 ${className}`}
			{...props}
		/>
	);
}

// Componente SidebarInset
export function SidebarInset({
	className = "",
	...props
}: React.HTMLAttributes<HTMLElement>) {
	return (
		<main
			data-slot="sidebar-inset"
			className={`bg-white relative flex max-w-full min-h-screen flex-1 flex-col peer-data-[variant=inset]:min-h-[calc(100vh-(--spacing(4)))] md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0 ${className}`}
			{...props}
		/>
	);
}
