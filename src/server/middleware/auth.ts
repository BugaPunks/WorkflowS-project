import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
	throw new Error(
		"JWT_SECRET environment variable is required. Server cannot start without it.",
	);
}

export interface AuthUser {
	userId: string;
	email: string;
	role: string;
}

declare global {
	namespace Express {
		interface Request {
			user?: AuthUser;
			projectMembership?: {
				id: string;
				role: string;
				projectId: string;
				userId: string;
			};
		}
	}
}

export const authenticateToken = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	const authHeader = req.headers.authorization;
	const token = authHeader?.split(" ")[1];

	if (!token) {
		res.sendStatus(401);
		return;
	}

	jwt.verify(token, JWT_SECRET, (err, decoded) => {
		if (err) {
			res.sendStatus(403);
			return;
		}
		req.user = decoded as AuthUser;
		next();
	});
};
