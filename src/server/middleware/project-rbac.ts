import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";

type ProjectIdResolver = (
	req: Request,
) => string | null | Promise<string | null>;

const defaultResolver: ProjectIdResolver = (req) =>
	req.params.projectId || req.params.id || req.body.projectId || null;

export const requireProjectRole = (
	roles: string[],
	resolver: ProjectIdResolver = defaultResolver,
) => {
	return async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		if (!req.user) {
			res.sendStatus(401);
			return;
		}

		// ADMIN bypass: teachers can access any project
		if (req.user.role === "ADMIN") {
			next();
			return;
		}

		const projectId = await resolver(req);
		if (!projectId) {
			res.status(400).json({ error: "projectId required" });
			return;
		}

		const membership = await prisma.projectMember.findUnique({
			where: {
				projectId_userId: {
					projectId,
					userId: req.user.userId,
				},
			},
		});

		if (!membership || !roles.includes(membership.role)) {
			res.sendStatus(403);
			return;
		}

		req.projectMembership = membership;
		next();
	};
};
