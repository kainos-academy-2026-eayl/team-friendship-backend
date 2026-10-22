CREATE EXTENSION IF NOT EXISTS citext;

WITH ranked_customers AS (
    SELECT
        "customerID",
        ROW_NUMBER() OVER (
            PARTITION BY "customerEmail"::citext
            ORDER BY "customerID"
        ) AS duplicate_rank
    FROM "Customer"
)
DELETE FROM "Customer"
USING ranked_customers
WHERE "Customer"."customerID" = ranked_customers."customerID"
  AND ranked_customers.duplicate_rank > 1;

ALTER TABLE "Customer"
    ALTER COLUMN "customerEmail" TYPE CITEXT
    USING "customerEmail"::citext;

CREATE UNIQUE INDEX "Customer_customerEmail_key" ON "Customer"("customerEmail");
