import type { ReactNode } from "react";
import { type BreadcrumbItem, Breadcrumbs } from "./Breadcrumbs";

export interface PageHeaderProps {
	breadcrumbs: BreadcrumbItem[];
	title: string;
	subtitle?: ReactNode;
	actions?: ReactNode;
}

export function PageHeader({
	breadcrumbs,
	title,
	subtitle,
	actions,
}: PageHeaderProps) {
	return (
		<div className="mb-8">
			<Breadcrumbs items={breadcrumbs} />
			<div className="flex flex-wrap justify-between items-start gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">{title}</h1>
					{subtitle && <div className="text-gray-500 mt-1">{subtitle}</div>}
				</div>
				{actions && <div className="flex gap-2">{actions}</div>}
			</div>
		</div>
	);
}
