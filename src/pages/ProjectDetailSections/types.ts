export interface ChatMessage {
	id: string;
	user: { name: string };
	content: string;
	userId: string;
}

export interface DocumentItem {
	id: string;
	name: string;
	type: string;
	size: number;
	uploadedAt: string;
	url: string;
	version: number;
	latestVersion?: number; // From aggregation
	versionCount?: number; // From aggregation
}

export interface DocumentVersion {
	id: string;
	version: number;
	uploadedAt: string;
	url: string;
}

export interface ProjectMemberDetails {
	id: string;
	userId: string;
	role: string;
	user?: {
		name: string;
		email: string;
	};
}

export interface AvailableUser {
	id: string;
	name: string;
	email: string;
}
