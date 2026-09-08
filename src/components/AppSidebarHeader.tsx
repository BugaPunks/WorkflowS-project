import { SidebarTrigger } from "./ui/sidebar";

export function AppSidebarHeader() {
	return (
		<header className="border-gray-200 flex h-16 shrink-0 items-center gap-2 border-b px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
			<div className="flex items-center gap-2">
				<SidebarTrigger className="-ml-1" />
				<div className="flex items-center">
					<h1 className="text-lg font-semibold">WorkflowS</h1>
				</div>
			</div>
		</header>
	);
}
