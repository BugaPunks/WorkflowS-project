import { describe, expect, test } from "vitest";
import {
	computeBurndown,
	computeContribution,
	computeVelocity,
} from "./metrics";

describe("computeBurndown", () => {
	test("4.6 Cover the §7a case: 100 total points over 10 elapsed days yields exactly 50 at day index 5", () => {
		const sprint = {
			startDate: new Date("2026-04-01T00:00:00Z"),
			endDate: new Date("2026-04-11T00:00:00Z"),
			userStories: [{ storyPoints: 100, completedAt: null }],
		};
		const result = computeBurndown(sprint);

		expect(result.totalPoints).toBe(100);
		expect(result.series.length).toBe(11);
		expect(result.series[5].ideal).toBe(50);
	});

	test("4.7 Cover day-index semantics: 9 elapsed days produce 10 points indexed 0-9, and the ideal value at the final index is 0", () => {
		const sprint = {
			startDate: new Date("2026-04-01T00:00:00Z"),
			endDate: new Date("2026-04-10T00:00:00Z"),
			userStories: [{ storyPoints: 100, completedAt: null }],
		};
		const result = computeBurndown(sprint);

		expect(result.series.length).toBe(10);
		expect(result.series[0].day).toBe(0);
		expect(result.series[9].day).toBe(9);
		expect(result.series[9].ideal).toBe(0);
	});

	test("4.8 Cover the actual line: a 40-point story completed on day 3 gives 60 from day 3 onward; future indices report null; a story completed before the sprint start is excluded from day 0; no actual value is negative", () => {
		const oldNow = Date.now;
		const mockNow = new Date("2026-04-05T12:00:00Z").getTime();
		Date.now = () => mockNow;

		const sprint = {
			startDate: new Date("2026-04-01T00:00:00Z"),
			endDate: new Date("2026-04-11T00:00:00Z"),
			userStories: [
				{ storyPoints: 40, completedAt: new Date("2026-04-04T12:00:00Z") }, // day 3 (April 4th)
				{ storyPoints: 60, completedAt: new Date("2026-03-31T12:00:00Z") }, // before start date, counts as burned at day 0
			],
		};
		const result = computeBurndown(sprint);

		// Before start date story is 60 points. So at day 0 (April 1st), burned is 60. Remaining is 40.
		// Then at day 3 (April 4th), 40 points burned. Remaining is 0.
		expect(result.series[0].actual).toBe(40);
		expect(result.series[1].actual).toBe(40);
		expect(result.series[2].actual).toBe(40);
		expect(result.series[3].actual).toBe(0);
		expect(result.series[4].actual).toBe(0);

		// Today is April 5th (day 4), so index 5 (April 6th) and beyond should be null
		expect(result.series[5].actual).toBeNull();
		expect(result.series[6].actual).toBeNull();

		Date.now = oldNow;
	});

	test("4.9 Cover degenerate inputs: same-day sprint, end date before start date, sprint without dates, sprint without stories", () => {
		// Same-day sprint
		const sameDaySprint = {
			startDate: new Date("2026-04-01T00:00:00Z"),
			endDate: new Date("2026-04-01T00:00:00Z"),
			userStories: [{ storyPoints: 20, completedAt: null }],
		};
		const result1 = computeBurndown(sameDaySprint);
		expect(result1.series.length).toBe(1);
		expect(result1.series[0].ideal).toBe(20);
		expect(result1.series[0].actual).toBe(20);

		// End date before start date
		const negativeSprint = {
			startDate: new Date("2026-04-02T00:00:00Z"),
			endDate: new Date("2026-04-01T00:00:00Z"),
			userStories: [{ storyPoints: 20, completedAt: null }],
		};
		const result2 = computeBurndown(negativeSprint);
		expect(result2.series.length).toBe(0);

		// Sprint without dates
		const noDateSprint = {
			userStories: [{ storyPoints: 20, completedAt: null }],
		};
		const result3 = computeBurndown(noDateSprint);
		expect(result3.series.length).toBe(0);

		// Sprint without stories
		const noStorySprint = {
			startDate: new Date("2026-04-01T00:00:00Z"),
			endDate: new Date("2026-04-10T00:00:00Z"),
			userStories: [],
		};
		const result4 = computeBurndown(noStorySprint);
		expect(result4.totalPoints).toBe(0);
		expect(result4.series[9].ideal).toBe(0);
		expect(result4.series[9].actual).toBe(0);
	});
});

describe("computeVelocity", () => {
	test("4.10 Cover velocity: committed vs completed, ordering by start date", () => {
		const sprints = [
			{
				name: "Sprint 2",
				startDate: new Date("2026-04-15T00:00:00Z"),
				userStories: [
					{ storyPoints: 10, completedAt: new Date() },
					{ storyPoints: 5, completedAt: null },
				],
			},
			{
				name: "Sprint 1",
				startDate: new Date("2026-04-01T00:00:00Z"),
				userStories: [
					{ storyPoints: 20, completedAt: new Date() },
					{ storyPoints: 10, completedAt: new Date() },
				],
			},
			{
				name: "Sprint 3",
				startDate: null,
				userStories: [{ storyPoints: 15, completedAt: null }],
			},
		];

		const result = computeVelocity(sprints);

		expect(result[0].name).toBe("Sprint 1");
		expect(result[0].committed).toBe(30);
		expect(result[0].completed).toBe(30);

		expect(result[1].name).toBe("Sprint 2");
		expect(result[1].committed).toBe(15);
		expect(result[1].completed).toBe(10);

		expect(result[2].name).toBe("Sprint 3");
	});
});

describe("computeContribution", () => {
	test("4.10 Cover contribution: member with no completed tasks, unassigned separate", () => {
		const tasks = [
			{ status: "COMPLETED", assignee: { id: "u1", name: "Alice" } },
			{ status: "COMPLETED", assignee: { id: "u1", name: "Alice" } },
			{ status: "COMPLETED", assignee: { id: "u2", name: "Bob" } },
			{ status: "TODO", assignee: { id: "u3", name: "Charlie" } },
			{ status: "COMPLETED" }, // unassigned
			{ status: "COMPLETED" }, // unassigned
			{ status: "COMPLETED" }, // unassigned
		];

		const result = computeContribution(tasks);

		// Sort is descending by count. Unassigned has 3, Alice has 2, Bob has 1, Charlie has 0 (omitted)
		expect(result.length).toBe(3);

		expect(result[0].user).toBeNull(); // unassigned
		expect(result[0].count).toBe(3);

		expect(result[1].user?.name).toBe("Alice");
		expect(result[1].count).toBe(2);

		expect(result[2].user?.name).toBe("Bob");
		expect(result[2].count).toBe(1);
	});
});
