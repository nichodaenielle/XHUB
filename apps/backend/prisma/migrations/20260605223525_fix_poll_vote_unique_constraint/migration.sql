/*
  Warnings:

  - A unique constraint covering the columns `[pollId,userId,optionId]` on the table `poll_votes` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "poll_votes_pollId_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_userId_optionId_key" ON "poll_votes"("pollId", "userId", "optionId");
