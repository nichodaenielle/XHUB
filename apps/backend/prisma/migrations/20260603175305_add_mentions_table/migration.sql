-- CreateTable
CREATE TABLE "mentions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentions_messageId_idx" ON "mentions"("messageId");

-- CreateIndex
CREATE INDEX "mentions_mentionedUserId_idx" ON "mentions"("mentionedUserId");

-- CreateIndex
CREATE INDEX "mentions_channelId_idx" ON "mentions"("channelId");

-- CreateIndex
CREATE INDEX "mentions_isRead_idx" ON "mentions"("isRead");

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
