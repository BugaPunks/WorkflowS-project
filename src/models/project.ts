// Definición de roles en un proyecto (compatibles con el esquema de Prisma)
export enum ProjectRole {
	OWNER = "OWNER",
	LEAD = "LEAD",
	MEMBER = "MEMBER",
}

// Definición de estados de proyecto (compatibles con el esquema de Prisma)
export enum ProjectStatus {
	PLANNING = "PLANNING",
	IN_PROGRESS = "IN_PROGRESS",
	ON_HOLD = "ON_HOLD",
	ACTIVE = "ACTIVE",
	COMPLETED = "COMPLETED",
	CANCELLED = "CANCELLED",
	ARCHIVED = "ARCHIVED",
}

// Modelo de proyecto (compatible con el esquema de Prisma)
export interface Project {
	id: string;
	name: string;
	description?: string;
	status: ProjectStatus;
	createdAt: Date;
	updatedAt: Date;
	ownerId: string;
	startDate?: Date;
	endDate?: Date;
	// Campos relacionados que pueden no estar incluidos inicialmente
	members?: ProjectMember[];
}

// Miembro de proyecto (compatible con el esquema de Prisma)
export interface ProjectMember {
	id: string;
	projectId: string;
	userId: string;
	role: ProjectRole;
	joinedAt: Date;
}

// Definición de roles en un proyecto (como tipo para uso específico)
export type ProjectRoleType = "OWNER" | "LEAD" | "MEMBER";

// Tipos de estado de proyecto
export type ProjectStatusType =
	| "PLANNING"
	| "IN_PROGRESS"
	| "ON_HOLD"
	| "ACTIVE"
	| "COMPLETED"
	| "CANCELLED"
	| "ARCHIVED";
