import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
	label: string;
	to?: string;
}

export interface BreadcrumbsProps {
	items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
	return (
		<nav aria-label="Breadcrumb" className="mb-4">
			<ol className="flex items-center text-sm text-gray-500">
				{items.map((item, index) => {
					const isLast = index === items.length - 1;
					// Use label + index for a more stable key, assuming labels might be non-unique
					const key = `${item.label}-${index}`;

					return (
						<li key={key} className="flex items-center">
							{isLast || !item.to ? (
								<span
									aria-current={isLast ? "page" : undefined}
									className={isLast ? "text-gray-900 font-medium" : ""}
								>
									{item.label}
								</span>
							) : (
								<Link
									to={item.to}
									className="hover:text-blue-950 transition-colors"
								>
									{item.label}
								</Link>
							)}

							{!isLast && (
								<ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
