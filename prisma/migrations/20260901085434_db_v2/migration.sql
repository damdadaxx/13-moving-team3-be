/*
  Warnings:

  - You are about to drop the column `arrivalRegion` on the `estimateRequest` table. All the data in the column will be lost.
  - You are about to drop the column `departureRegion` on the `estimateRequest` table. All the data in the column will be lost.
  - You are about to drop the `designatedRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requestRejection` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[customerId]` on the table `estimateRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `arrivalZipCode` to the `estimateRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departureZipCode` to the `estimateRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstimateStatus" ADD VALUE 'REJECTED';
ALTER TYPE "EstimateStatus" ADD VALUE 'DESIGNATED';

-- DropForeignKey
ALTER TABLE "designatedRequest" DROP CONSTRAINT "designatedRequest_estimateRequestId_fkey";

-- DropForeignKey
ALTER TABLE "designatedRequest" DROP CONSTRAINT "designatedRequest_moverId_fkey";

-- DropForeignKey
ALTER TABLE "requestRejection" DROP CONSTRAINT "requestRejection_designatedRequestId_fkey";

-- DropIndex
DROP INDEX "estimateRequest_arrivalRegion_idx";

-- DropIndex
DROP INDEX "estimateRequest_customerId_active_key";

-- DropIndex
DROP INDEX "estimateRequest_departureRegion_idx";

-- AlterTable
ALTER TABLE "estimate" ADD COLUMN     "rejectreason" TEXT,
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "comment" DROP NOT NULL;

-- AlterTable
ALTER TABLE "estimateRequest" DROP COLUMN "arrivalRegion",
DROP COLUMN "departureRegion",
ADD COLUMN     "arrivalZipCode" INTEGER NOT NULL,
ADD COLUMN     "departureZipCode" INTEGER NOT NULL;

-- DropTable
DROP TABLE "designatedRequest";

-- DropTable
DROP TABLE "requestRejection";

-- CreateIndex
CREATE UNIQUE INDEX "estimateRequest_customerId_active_key" ON "estimateRequest"("customerId") WHERE ("status" IN ('PENDING', 'CONFIRMED'));
