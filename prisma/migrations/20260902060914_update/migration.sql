/*
  Warnings:

  - A unique constraint covering the columns `[customerId]` on the table `estimateRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "estimateRequest_customerId_active_key";

-- CreateIndex
CREATE UNIQUE INDEX "estimateRequest_customerId_active_key" ON "estimateRequest"("customerId") WHERE ("status" IN ('PENDING', 'CONFIRMED'));
