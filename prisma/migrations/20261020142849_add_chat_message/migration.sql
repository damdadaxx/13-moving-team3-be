-- CreateTable
CREATE TABLE "chatMessage" (
    "id" UUID NOT NULL,
    "estimateId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "content" TEXT,
    "imagePath" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatMessage_estimateId_createdAt_id_idx" ON "chatMessage"("estimateId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "chatMessage_estimateId_isRead_idx" ON "chatMessage"("estimateId", "isRead") WHERE ("isRead" = false);

-- AddForeignKey
ALTER TABLE "chatMessage" ADD CONSTRAINT "chatMessage_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

