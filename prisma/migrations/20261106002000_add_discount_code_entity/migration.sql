-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISABLED');

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "discount" INTEGER NOT NULL,
    "status" "DiscountStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiryDate" TIMESTAMP(3),

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id"),
    -- Prisma cannot express these rules, so they are enforced by the database.
    CONSTRAINT "DiscountCode_discount_range" CHECK ("discount" BETWEEN 1 AND 100),
    CONSTRAINT "DiscountCode_code_normalised" CHECK ("code" = UPPER(BTRIM("code")) AND "code" <> '')
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "discountCodeID" INTEGER;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountCodeID_fkey" FOREIGN KEY ("discountCodeID") REFERENCES "DiscountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FRIENDSHIP12 was previously hard-coded in the backend; keep it available in every environment.
INSERT INTO "DiscountCode" ("code", "discount", "status") VALUES ('FRIENDSHIP12', 12, 'ACTIVE');

-- Link any orders already placed with a code to the new record.
UPDATE "Order" AS o
SET "discountCodeID" = d."id"
FROM "DiscountCode" AS d
WHERE o."discountCode" = d."code";
