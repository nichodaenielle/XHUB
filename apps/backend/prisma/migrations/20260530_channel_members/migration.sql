-- Subject-group channel membership (class sections)
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "channels_externalId_key" ON "channels"("externalId");

CREATE TABLE IF NOT EXISTS "channel_members" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalUserId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "channel_members_channelId_userId_key" ON "channel_members"("channelId", "userId");
CREATE INDEX IF NOT EXISTS "channel_members_channelId_idx" ON "channel_members"("channelId");
CREATE INDEX IF NOT EXISTS "channel_members_userId_idx" ON "channel_members"("userId");

DO $$ BEGIN
    ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Existing sg-* channels become private section channels
UPDATE "channels" SET "type" = 'PRIVATE' WHERE "name" LIKE 'sg-%' AND "type" = 'PUBLIC';
