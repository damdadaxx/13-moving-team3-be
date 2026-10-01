/*
  Warnings:

  - You are about to drop the column `rejectreason` on the `estimate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[customerId]` on the table `estimateRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "estimateRequest_customerId_active_key";

-- AlterTable
ALTER TABLE "estimate" DROP COLUMN "rejectreason",
ADD COLUMN     "rejectReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "estimateRequest_customerId_active_key" ON "estimateRequest"("customerId") WHERE ("status" IN ('PENDING', 'CONFIRMED'));
