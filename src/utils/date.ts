import { differenceInCalendarDays, isToday } from "date-fns";

export function getDaysDifference(date: string | Date): number {
	const target = new Date(date);
	return differenceInCalendarDays(target, new Date());
}

export function formatDaysRemaining(date: string | Date): string {
	const target = new Date(date);
	if (isToday(target)) return "hoy";

	const diff = getDaysDifference(target);

	if (diff < 0) {
		const absDays = Math.abs(diff);
		return `hace ${absDays} ${absDays === 1 ? "día" : "días"}`;
	} else {
		return `${diff} ${diff === 1 ? "día restante" : "días restantes"}`;
	}
}
