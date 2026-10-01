-- DropIndex
DROP INDEX "estimateRequest_customerId_active_key";

-- CreateIndex
CREATE UNIQUE INDEX "estimateRequest_customerId_active_key" ON "estimateRequest"("customerId") WHERE ("status" IN ('PENDING', 'CONFIRMED'));
