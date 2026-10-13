import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";

const PROJECT_ROLES: readonly string[] = [
	"TEAM_DEVELOPER",
	"SCRUM_MASTER",
	"PRODUCT_OWNER",
];

type ChatParticipant = { userId: string };

/**
 * Autoriza el acceso a una conversación por id (chatId en los params):
 * - ADMIN: bypass (consistente con requireProjectRole y /user/:userId/all).
 * - DIRECT: solo participantes del chat.
 * - PROJECT: solo miembros del proyecto con rol de equipo.
 * - Cualquier otra situación: fail-closed (403/404).
 */
export const requireChatParticipant = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	if (!req.user) {
		res.sendStatus(401);
		return;
	}

	const requesterId = req.user.userId;
	const requesterRole = req.user.role;

	if (requesterRole === "ADMIN") {
		next();
		return;
	}

	const { chatId } = req.params;
	if (!chatId) {
		res.status(400).json({ error: "chatId required" });
		return;
	}

	const chat = await prisma.chat.findUnique({
		where: { id: chatId },
		include: { participants: true },
	});

	if (!chat) {
		res.sendStatus(404);
		return;
	}

	if (chat.type === "DIRECT") {
		const isParticipant = chat.participants.some(
			(p: ChatParticipant) => p.userId === requesterId,
		);
		if (!isParticipant) {
			res.sendStatus(403);
			return;
		}
		next();
		return;
	}

	if (chat.type === "PROJECT" && chat.projectId) {
		const membership = await prisma.projectMember.findUnique({
			where: {
				projectId_userId: {
					projectId: chat.projectId,
					userId: requesterId,
				},
			},
		});

		if (!membership || !PROJECT_ROLES.includes(membership.role)) {
			res.sendStatus(403);
			return;
		}
		next();
		return;
	}

	res.sendStatus(403);
};
