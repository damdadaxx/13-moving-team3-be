/*
  Warnings:

  - A unique constraint covering the columns `[customerId]` on the table `estimateRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,providerId,role]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "estimateRequest_customerId_active_key";

-- DropIndex
DROP INDEX "user_provider_providerId_key";

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "phoneNumber" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "estimateRequest_customerId_active_key" ON "estimateRequest"("customerId") WHERE ("status" IN ('PENDING', 'CONFIRMED'));

-- CreateIndex
CREATE UNIQUE INDEX "user_provider_providerId_role_key" ON "user"("provider", "providerId", "role");
