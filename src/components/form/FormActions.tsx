import { Button } from "@/components/Button";

interface FormActionsProps {
	onCancel: () => void;
	isSubmitting: boolean;
	submitText: string;
	submittingText: string;
	cancelText?: string;
	submitButtonClass?: string;
	cancelButtonClass?: string;
}

export default function FormActions({
	onCancel,
	isSubmitting,
	submitText,
	submittingText,
	cancelText = "Cancelar",
	submitButtonClass = "bg-blue-950 hover:bg-blue-900",
	cancelButtonClass = "bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-400",
}: FormActionsProps) {
	return (
		<div className="flex items-center justify-end pt-4 border-t border-gray-200 mt-6">
			<Button
				type="button"
				onClick={onCancel}
				className={`${cancelButtonClass} font-bold py-2 px-4 rounded mr-2`}
			>
				{cancelText}
			</Button>
			<Button
				type="submit"
				disabled={isSubmitting}
				className={`${submitButtonClass} text-white font-bold py-2 px-4 rounded ${
					isSubmitting ? "opacity-50 cursor-not-allowed" : ""
				}`}
			>
				{isSubmitting ? submittingText : submitText}
			</Button>
		</div>
	);
}
