import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
	throw new Error(
		"JWT_SECRET environment variable is required. Server cannot start without it.",
	);
}

export const JWT_ISSUER = "workflows-api";
export const JWT_AUDIENCE = "workflows-web";
export const AUTH_COOKIE_NAME = "token";

export interface AuthUser {
	userId: string;
	email: string;
	role: string;
	tokenVersion: number;
}

interface TokenPayload {
	userId: string;
	email: string;
	role: string;
	v: number;
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

const getTokenFromRequest = (req: Request): string | null => {
	const fromCookie = req.cookies?.[AUTH_COOKIE_NAME];
	if (fromCookie) {
		return fromCookie;
	}
	const authHeader = req.headers.authorization;
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.slice("Bearer ".length);
	}
	return null;
};

export const authenticateToken = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	const token = getTokenFromRequest(req);

	if (!token) {
		res.setHeader("WWW-Authenticate", "Bearer");
		res.sendStatus(401);
		return;
	}

	let payload: TokenPayload;
	try {
		payload = jwt.verify(token, JWT_SECRET, {
			algorithms: ["HS256"],
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		}) as TokenPayload;
	} catch {
		res.setHeader("WWW-Authenticate", "Bearer");
		res.sendStatus(401);
		return;
	}

	try {
		const user = await prisma.user.findUnique({
			where: { id: payload.userId },
			select: {
				id: true,
				email: true,
				role: true,
				active: true,
				tokenVersion: true,
			},
		});

		if (!user || !user.active || user.tokenVersion !== payload.v) {
			res.setHeader("WWW-Authenticate", "Bearer");
			res.sendStatus(401);
			return;
		}

		req.user = {
			userId: user.id,
			email: user.email,
			role: user.role,
			tokenVersion: user.tokenVersion,
		};
		next();
	} catch {
		res.sendStatus(500);
	}
};
