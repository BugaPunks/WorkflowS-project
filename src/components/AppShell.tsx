import { Menu } from "lucide-react";
import type React from "react";
import { Link } from "react-router-dom";
import NavigationSidebar from "@/components/NavigationSidebar";
import SidebarProvider, { useSidebar } from "@/islands/SidebarProvider";

interface AppShellProps {
	children: React.ReactNode;
	variant?: "header" | "sidebar";
	user?: { id: string; name: string; email: string; role: string };
}

function ShellContent({
	children,
	user,
}: {
	children: React.ReactNode;
	user?: { id: string; name: string; email: string; role: string };
}) {
	const { open, isMobile, openMobile, setOpenMobile } = useSidebar();

	// Determine the effective open state for the sidebar component
	// On desktop: 'open' controls expanded/collapsed (width).
	// On mobile: 'openMobile' controls visible/hidden.
	const sidebarOpen = isMobile ? openMobile : open;

	// Close handler for mobile overlay or clicking links on mobile
	const handleClose = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<div className="flex min-h-screen w-full bg-gray-50/50">
			<NavigationSidebar
				isOpen={sidebarOpen}
				user={user}
				onClose={handleClose}
			/>

			<main className="flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ease-in-out">
				{/* Mobile Header Trigger */}
				<div className="lg:hidden flex items-center h-16 px-4 border-b border-gray-200 bg-white shrink-0">
					<button
						type="button"
						onClick={() => setOpenMobile(true)}
						className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md"
						aria-label="Abrir menú"
					>
						<Menu size={24} />
					</button>
					<Link
						to="/"
						className="ml-3 font-bold text-lg text-gray-900 hover:opacity-80 transition-opacity"
					>
						WorkflowS
					</Link>
				</div>

				<div className="flex-1 overflow-y-auto p-4 md:p-8">
					<div className="mx-auto max-w-6xl">{children}</div>
				</div>
			</main>
		</div>
	);
}

function AppShellComponent({
	children,
	variant = "sidebar",
	user,
}: AppShellProps): React.ReactElement {
	if (variant === "header") {
		return (
			<div className="flex min-h-screen w-full flex-col bg-gray-50">
				{children}
			</div>
		);
	}

	return (
		<SidebarProvider defaultOpen={true}>
			<ShellContent user={user}>{children}</ShellContent>
		</SidebarProvider>
	);
}

export default AppShellComponent;
export { AppShellComponent as AppShell };
