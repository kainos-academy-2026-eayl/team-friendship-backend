CREATE TABLE "Staff" (
    "staffID" SERIAL NOT NULL,
    "staffForename" TEXT NOT NULL,
    "staffSurname" TEXT NOT NULL,
    "staffRole" TEXT NOT NULL DEFAULT 'STAFF',
    "staffavailability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "staffEmail" TEXT NOT NULL,
    "staffPassword" TEXT NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("staffID")
);

CREATE UNIQUE INDEX "Staff_staffEmail_key" ON "Staff"("staffEmail");

INSERT INTO "Staff" (
    "staffForename",
    "staffSurname",
    "staffRole",
    "staffavailability",
    "staffEmail",
    "staffPassword"
)
SELECT
    "customerForename",
    "customerSurname",
    'ADMIN',
    'AVAILABLE',
    "customerEmail",
    "customerPassword"
FROM "Customer"
WHERE "role"::TEXT = 'ADMIN'
ON CONFLICT ("staffEmail") DO NOTHING;

ALTER TABLE "RefreshToken"
    ALTER COLUMN "customerID" DROP NOT NULL,
    ADD COLUMN "staffID" INTEGER;

UPDATE "RefreshToken" AS refresh_token
SET "staffID" = staff."staffID",
    "customerID" = NULL
FROM "Customer" AS customer
JOIN "Staff" AS staff
  ON staff."staffEmail" = customer."customerEmail"
WHERE refresh_token."customerID" = customer."customerID"
  AND customer."role"::TEXT = 'ADMIN';

CREATE INDEX "RefreshToken_staffID_idx" ON "RefreshToken"("staffID");

ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_staffID_fkey"
    FOREIGN KEY ("staffID") REFERENCES "Staff"("staffID")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "RefreshToken_exactly_one_principal_check"
    CHECK (("customerID" IS NOT NULL) <> ("staffID" IS NOT NULL));

ALTER TABLE "Customer" DROP COLUMN "role";
DROP TYPE "CustomerRole";
