-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'MOVER');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'KAKAO', 'NAVER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SMALL_MOVE', 'HOME_MOVE', 'OFFICE_MOVE');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('SEOUL', 'GYEONGGI', 'INCHEON', 'GANGWON', 'CHUNGBUK', 'CHUNGNAM', 'SEJONG', 'DAEJEON', 'JEONBUK', 'JEONNAM', 'GWANGJU', 'GYEONGBUK', 'GYEONGNAM', 'DAEGU', 'ULSAN', 'BUSAN', 'JEJU');

-- CreateEnum
CREATE TYPE "EstimateRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'NOT_SELECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_ESTIMATE', 'NEW_REQUEST', 'ESTIMATE_CONFIRMED', 'MOVE_DAY');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "password" TEXT,
    "refreshToken" TEXT,
    "role" "Role" NOT NULL,
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerProfile" (
    "userId" UUID NOT NULL,
    "imgUrl" TEXT,
    "region" "Region" NOT NULL,
    "activeEstimateRequestId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "customerServiceType" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "serviceType" "ServiceType" NOT NULL,

    CONSTRAINT "customerServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moverProfile" (
    "userId" UUID NOT NULL,
    "imgUrl" TEXT,
    "nickname" TEXT NOT NULL,
    "careerMonths" INTEGER NOT NULL,
    "shortIntro" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moverProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "moverServiceType" (
    "id" UUID NOT NULL,
    "moverId" UUID NOT NULL,
    "serviceType" "ServiceType" NOT NULL,

    CONSTRAINT "moverServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moverServiceRegion" (
    "id" UUID NOT NULL,
    "moverId" UUID NOT NULL,
    "region" "Region" NOT NULL,

    CONSTRAINT "moverServiceRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimateRequest" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "moveDate" TIMESTAMP(3) NOT NULL,
    "departureAddress" TEXT NOT NULL,
    "departureRegion" "Region" NOT NULL,
    "arrivalAddress" TEXT NOT NULL,
    "arrivalRegion" "Region" NOT NULL,
    "status" "EstimateRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designatedRequest" (
    "id" UUID NOT NULL,
    "estimateRequestId" UUID NOT NULL,
    "moverId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "designatedRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate" (
    "id" UUID NOT NULL,
    "estimateRequestId" UUID NOT NULL,
    "moverId" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isDesignated" BOOLEAN NOT NULL DEFAULT false,
    "status" "EstimateStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requestRejection" (
    "id" UUID NOT NULL,
    "designatedRequestId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requestRejection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "like" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "moverId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" UUID NOT NULL,
    "estimateId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "moverId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "content" TEXT NOT NULL,
    "targetPath" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_phoneNumber_idx" ON "user"("phoneNumber");

-- CreateIndex
CREATE INDEX "user_name_idx" ON "user"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_role_key" ON "user"("email", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_provider_providerId_key" ON "user"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "customerProfile_activeEstimateRequestId_key" ON "customerProfile"("activeEstimateRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "customerServiceType_customerId_serviceType_key" ON "customerServiceType"("customerId", "serviceType");

-- CreateIndex
CREATE INDEX "moverProfile_careerMonths_idx" ON "moverProfile"("careerMonths");

-- CreateIndex
CREATE INDEX "moverProfile_nickname_idx" ON "moverProfile"("nickname");

-- CreateIndex
CREATE INDEX "moverServiceType_serviceType_idx" ON "moverServiceType"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "moverServiceType_moverId_serviceType_key" ON "moverServiceType"("moverId", "serviceType");

-- CreateIndex
CREATE INDEX "moverServiceRegion_region_idx" ON "moverServiceRegion"("region");

-- CreateIndex
CREATE UNIQUE INDEX "moverServiceRegion_moverId_region_key" ON "moverServiceRegion"("moverId", "region");

-- CreateIndex
CREATE INDEX "estimateRequest_customerId_status_idx" ON "estimateRequest"("customerId", "status");

-- CreateIndex
CREATE INDEX "estimateRequest_moveDate_idx" ON "estimateRequest"("moveDate");

-- CreateIndex
CREATE INDEX "estimateRequest_createdAt_idx" ON "estimateRequest"("createdAt");

-- CreateIndex
CREATE INDEX "estimateRequest_serviceType_idx" ON "estimateRequest"("serviceType");

-- CreateIndex
CREATE INDEX "estimateRequest_departureRegion_idx" ON "estimateRequest"("departureRegion");

-- CreateIndex
CREATE INDEX "estimateRequest_arrivalRegion_idx" ON "estimateRequest"("arrivalRegion");

-- CreateIndex
CREATE UNIQUE INDEX "estimateRequest_customerId_active_key" ON "estimateRequest"("customerId") WHERE ("status" IN ('PENDING', 'CONFIRMED'));

-- CreateIndex
CREATE INDEX "designatedRequest_moverId_idx" ON "designatedRequest"("moverId");

-- CreateIndex
CREATE UNIQUE INDEX "designatedRequest_estimateRequestId_moverId_key" ON "designatedRequest"("estimateRequestId", "moverId");

-- CreateIndex
CREATE INDEX "estimate_estimateRequestId_isDesignated_idx" ON "estimate"("estimateRequestId", "isDesignated");

-- CreateIndex
CREATE INDEX "estimate_moverId_status_idx" ON "estimate"("moverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_estimateRequestId_moverId_key" ON "estimate"("estimateRequestId", "moverId");

-- CreateIndex
CREATE UNIQUE INDEX "requestRejection_designatedRequestId_key" ON "requestRejection"("designatedRequestId");

-- CreateIndex
CREATE INDEX "like_moverId_idx" ON "like"("moverId");

-- CreateIndex
CREATE UNIQUE INDEX "like_customerId_moverId_key" ON "like"("customerId", "moverId");

-- CreateIndex
CREATE UNIQUE INDEX "review_estimateId_key" ON "review"("estimateId");

-- CreateIndex
CREATE INDEX "review_moverId_rating_idx" ON "review"("moverId", "rating");

-- CreateIndex
CREATE INDEX "review_customerId_idx" ON "review"("customerId");

-- CreateIndex
CREATE INDEX "notification_userId_isRead_idx" ON "notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "customerProfile" ADD CONSTRAINT "customerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerProfile" ADD CONSTRAINT "customerProfile_activeEstimateRequestId_fkey" FOREIGN KEY ("activeEstimateRequestId") REFERENCES "estimateRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerServiceType" ADD CONSTRAINT "customerServiceType_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moverProfile" ADD CONSTRAINT "moverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moverServiceType" ADD CONSTRAINT "moverServiceType_moverId_fkey" FOREIGN KEY ("moverId") REFERENCES "moverProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moverServiceRegion" ADD CONSTRAINT "moverServiceRegion_moverId_fkey" FOREIGN KEY ("moverId") REFERENCES "moverProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimateRequest" ADD CONSTRAINT "estimateRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designatedRequest" ADD CONSTRAINT "designatedRequest_estimateRequestId_fkey" FOREIGN KEY ("estimateRequestId") REFERENCES "estimateRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designatedRequest" ADD CONSTRAINT "designatedRequest_moverId_fkey" FOREIGN KEY ("moverId") REFERENCES "moverProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_estimateRequestId_fkey" FOREIGN KEY ("estimateRequestId") REFERENCES "estimateRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_moverId_fkey" FOREIGN KEY ("moverId") REFERENCES "moverProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requestRejection" ADD CONSTRAINT "requestRejection_designatedRequestId_fkey" FOREIGN KEY ("designatedRequestId") REFERENCES "designatedRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "like" ADD CONSTRAINT "like_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "like" ADD CONSTRAINT "like_moverId_fkey" FOREIGN KEY ("moverId") REFERENCES "moverProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_moverId_fkey" FOREIGN KEY ("moverId") REFERENCES "moverProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
