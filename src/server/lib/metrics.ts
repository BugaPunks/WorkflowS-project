export type UserStoryMinimal = {
	storyPoints?: number | null;
	completedAt?: Date | null;
};

export type SprintMinimal = {
	startDate?: Date | null;
	endDate?: Date | null;
	userStories: UserStoryMinimal[];
};

export type BurndownSeriesPoint = {
	day: number;
	date: string;
	ideal: number;
	actual: number | null;
};

export function computeBurndown(sprint: SprintMinimal): {
	totalPoints: number;
	series: BurndownSeriesPoint[];
} {
	const totalPoints = sprint.userStories.reduce(
		(acc, item) => acc + (item.storyPoints || 0),
		0,
	);

	if (!sprint.startDate || !sprint.endDate) {
		return { totalPoints, series: [] };
	}

	const start = new Date(sprint.startDate);
	const end = new Date(sprint.endDate);
	const daysDiff = Math.ceil(
		(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (daysDiff < 0) {
		return { totalPoints, series: [] };
	}

	const completedItems = sprint.userStories
		.filter(
			(item) => item.completedAt !== null && item.completedAt !== undefined,
		)
		.map((item) => ({
			points: item.storyPoints || 0,
			date: new Date(item.completedAt as Date),
		}));

	if (daysDiff === 0) {
		const burnedSoFar = completedItems
			.filter((item) => item.date <= start)
			.reduce((acc, item) => acc + item.points, 0);
		return {
			totalPoints,
			series: [
				{
					day: 0,
					date: start.toISOString().split("T")[0],
					ideal: totalPoints,
					actual: totalPoints - burnedSoFar,
				},
			],
		};
	}

	const series: BurndownSeriesPoint[] = [];
	const idealDecrement = totalPoints / daysDiff;
	const now = new Date(Date.now());

	for (let i = 0; i <= daysDiff; i++) {
		const currentDate = new Date(start);
		currentDate.setUTCDate(start.getUTCDate() + i);

		const burnedSoFar = completedItems
			.filter((item) => {
				const itemDateStr = item.date.toISOString().split("T")[0];
				const compDateStr = currentDate.toISOString().split("T")[0];
				return itemDateStr <= compDateStr;
			})
			.reduce((acc, item) => acc + item.points, 0);

		const actualRemaining = totalPoints - burnedSoFar;
		const idealRemaining = Math.max(0, totalPoints - idealDecrement * i);

		const isFuture =
			currentDate.toISOString().split("T")[0] > now.toISOString().split("T")[0];

		series.push({
			day: i,
			date: currentDate.toISOString().split("T")[0],
			ideal: idealRemaining,
			actual: isFuture ? null : actualRemaining,
		});
	}

	return { totalPoints, series };
}

export type SprintWithStories = {
	name: string;
	startDate?: Date | null;
	userStories: UserStoryMinimal[];
};

export function computeVelocity(sprints: SprintWithStories[]) {
	// 4.4 Move the velocity computation ... ordering dated sprints ascending and keeping undated sprints after them
	const sortedSprints = [...sprints].sort((a, b) => {
		if (!a.startDate && !b.startDate) return 0;
		if (!a.startDate) return 1;
		if (!b.startDate) return -1;
		return a.startDate.getTime() - b.startDate.getTime();
	});

	return sortedSprints.map((sprint) => {
		const committed = sprint.userStories.reduce(
			(acc, item) => acc + (item.storyPoints || 0),
			0,
		);
		const completed = sprint.userStories
			.filter(
				(item) => item.completedAt !== null && item.completedAt !== undefined,
			)
			.reduce((acc, item) => acc + (item.storyPoints || 0), 0);

		return {
			name: sprint.name,
			committed,
			completed,
		};
	});
}

export type TaskMinimal = {
	status: string;
	assignee?: {
		id: string;
		name: string;
		email?: string;
		avatar?: string | null;
	} | null;
};

export function computeContribution(tasks: TaskMinimal[]) {
	// 4.5 Move the contribution computation ... omitting members with no completed tasks and reporting unassigned completed tasks separately
	const contributionMap = new Map<
		string,
		{ user: { id: string; name: string } | null; count: number }
	>();

	tasks.forEach((task) => {
		if (task.status !== "COMPLETED") return;
		const userId = task.assignee ? task.assignee.id : "unassigned";
		if (!contributionMap.has(userId)) {
			contributionMap.set(userId, { user: task.assignee || null, count: 0 });
		}

		const entry = contributionMap.get(userId);
		if (entry) entry.count += 1;
	});

	const data = Array.from(contributionMap.values())
		.filter((entry) => entry.count > 0)
		.sort((a, b) => b.count - a.count);

	return data;
}
