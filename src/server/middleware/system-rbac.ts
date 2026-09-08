import type { NextFunction, Request, Response } from "express";

export const requireSystemRole = (...roles: string[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
			res.sendStatus(401);
			return;
		}
		if (!roles.includes(req.user.role)) {
			res.sendStatus(403);
			return;
		}
		next();
	};
};
