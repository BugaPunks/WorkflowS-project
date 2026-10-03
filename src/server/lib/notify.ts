import type { NotificationType } from "@prisma/client";
import { prisma } from "../db";

interface NotifyArgs {
	userId: string;
	type: NotificationType;
	title: string;
	message: string;
	entityType?: string;
	entityId?: string;
}

export async function notify(args: NotifyArgs) {
	const preference = await prisma.notificationPreference.findUnique({
		where: {
			userId_type: {
				userId: args.userId,
				type: args.type,
			},
		},
	});

	if (preference && !preference.enabled) {
		return null;
	}

	return prisma.notification.create({
		data: {
			userId: args.userId,
			type: args.type,
			title: args.title,
			message: args.message,
			entityType: args.entityType,
			entityId: args.entityId,
		},
	});
}
