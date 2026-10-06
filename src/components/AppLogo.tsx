import { AppLogoIcon } from "@/components/AppLogoIcon";

export function AppLogo() {
	return (
		<>
			<div className="bg-blue-950 text-white flex aspect-square size-8 items-center justify-center rounded-md">
				<AppLogoIcon className="size-5 fill-current text-white" />
			</div>
			<div className="ml-1 grid flex-1 text-left text-sm">
				<span className="mb-0.5 truncate leading-none font-semibold">
					WorkflowS
				</span>
			</div>
		</>
	);
}
