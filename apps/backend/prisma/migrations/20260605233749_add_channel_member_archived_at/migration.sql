-- AlterTable
ALTER TABLE "channel_members" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "channel_members_archivedAt_idx" ON "channel_members"("archivedAt");
