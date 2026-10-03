-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "entityId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "entityType" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "dashboardModules" TEXT;

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_type_key" ON "notification_preferences"("userId", "type");
