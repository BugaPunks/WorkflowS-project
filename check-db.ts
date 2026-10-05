import "dotenv/config";
import { prisma } from "./src/server/db";

async function main() {
	const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, name: true } });
	console.log('Users:', JSON.stringify(users, null, 2));
	const projects = await prisma.project.findMany();
	console.log('Projects:', JSON.stringify(projects, null, 2));
	await prisma.$disconnect();
}

main();