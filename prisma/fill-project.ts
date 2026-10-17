import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: "Sistema Biblioteca" },
    include: { members: { include: { user: true } } },
  });
  if (!project) throw new Error("Proyecto 'Sistema Biblioteca' no encontrado");

  const members = project.members.map((m) => m.user);
  if (members.length === 0) throw new Error("El proyecto no tiene miembros");

  const sprints = await prisma.sprint.findMany({
    where: { projectId: project.id },
    orderBy: { name: "asc" },
  });
  if (sprints.length === 0) throw new Error("El proyecto no tiene sprints");

  const sprintDates = [
    { start: new Date("2026-01-01"), end: new Date("2026-01-14") },
    { start: new Date("2026-01-15"), end: new Date("2026-01-28") },
    { start: new Date("2026-01-29"), end: new Date("2026-02-11") },
    { start: new Date("2026-02-12"), end: new Date("2026-02-25") },
  ];

  for (let i = 0; i < sprints.length; i++) {
    const sprint = sprints[i];
    const completed = i < 3;
    const dates = sprintDates[i] ?? sprintDates[sprintDates.length - 1];

    await prisma.sprint.update({
      where: { id: sprint.id },
      data: {
        status: completed ? "COMPLETED" : "ACTIVE",
        startDate: sprint.startDate ?? dates.start,
        endDate: sprint.endDate ?? dates.end,
      },
    });

    const existingStories = await prisma.userStory.count({ where: { sprintId: sprint.id } });
    if (existingStories > 0) {
      console.log(`Sprint ${i + 1} ya tiene HU, se omite.`);
      continue;
    }

    for (let h = 1; h <= 2; h++) {
      const story = await prisma.userStory.create({
        data: {
          projectId: project.id,
          sprintId: sprint.id,
          title: `Historia ${h} - Sprint ${i + 1}`,
          description: `Historia de usuario ${h} del sprint ${i + 1}`,
          priority: "HIGH",
          storyPoints: 5,
          status: completed ? "COMPLETED" : "IN_PROGRESS",
          assigneeId: members[(h - 1) % members.length].id,
          completedAt: completed ? new Date() : undefined,
        },
      });

      for (const member of members) {
        await prisma.task.create({
          data: {
            projectId: project.id,
            sprintId: sprint.id,
            userStoryId: story.id,
            title: `Tarea de ${member.name} - HU ${h}`,
            description: `Tarea asignada a ${member.name}`,
            priority: "MEDIUM",
            status: completed ? "COMPLETED" : "TODO",
            assigneeId: member.id,
            deadline: dates.end,
            completedAt: completed ? new Date() : undefined,
          },
        });
      }
    }
    console.log(`Sprint ${i + 1}: ${completed ? "COMPLETED" : "ACTIVE"} con 2 HU y ${members.length * 2} tareas`);
  }

  console.log("✅ Proyecto 'Sistema Biblioteca' actualizado");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
