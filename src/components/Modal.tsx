import { X } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
}

export function Modal({
	isOpen,
	onClose,
	title,
	children,
	className,
}: ModalProps) {
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		if (isOpen) window.addEventListener("keydown", handleEsc);
		return () => window.removeEventListener("keydown", handleEsc);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity w-full h-full cursor-default"
				onClick={onClose}
				aria-label="Close modal"
			/>
			<div
				className={cn(
					"bg-white rounded-xl shadow-2xl w-full max-w-md relative overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]",
					className,
				)}
			>
				{title && (
					<div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
						{title && (
							<h3 className="text-lg font-semibold text-gray-900">{title}</h3>
						)}
						<button
							type="button"
							onClick={onClose}
							className="text-gray-400 hover:text-gray-600 transition-colors ml-auto"
						>
							<X size={20} />
						</button>
					</div>
				)}
				<div className="overflow-y-auto p-6">{children}</div>
			</div>
		</div>
	);
}
