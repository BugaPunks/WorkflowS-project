import HeaderMenu from "@/islands/HeaderMenu";
import HeaderNav from "@/islands/HeaderNav";

export function Header() {
	return (
		<header className="bg-blue-600 text-white shadow-md">
			<div className="container mx-auto px-4 py-4 flex justify-between items-center">
				<div className="flex items-center">
					<img
						src="/logo.svg"
						width="40"
						height="40"
						alt="WorkflowS Logo"
						className="mr-3"
					/>
					<h1 className="text-2xl font-bold">WorkflowS</h1>
				</div>
				<HeaderMenu />
				<HeaderNav />
			</div>
		</header>
	);
}
