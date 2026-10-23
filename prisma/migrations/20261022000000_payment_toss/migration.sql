-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'BALANCE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('READY', 'PAID', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "estimateId" UUID NOT NULL,
    "type" "PaymentType" NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'READY',
    "paymentKey" TEXT,
    "failureMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_orderId_key" ON "payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_paymentKey_key" ON "payment"("paymentKey");

-- CreateIndex
CREATE UNIQUE INDEX "payment_estimateId_type_key" ON "payment"("estimateId", "type");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

