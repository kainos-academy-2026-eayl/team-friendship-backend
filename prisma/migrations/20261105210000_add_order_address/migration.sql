-- AlterTable
ALTER TABLE "Order" ADD COLUMN "address" TEXT,
ADD COLUMN "postcode" TEXT;

-- Backfill existing orders with the customer's saved address before enforcing NOT NULL.
UPDATE "Order" AS o
SET "address" = c."address",
    "postcode" = c."postcode"
FROM "Customer" AS c
WHERE o."customerID" = c."customerID";

ALTER TABLE "Order" ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "postcode" SET NOT NULL;
