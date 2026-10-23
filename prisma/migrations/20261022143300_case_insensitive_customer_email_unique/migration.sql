-- Keep the lowest-ID customer for each case-insensitive email identity.
DELETE FROM "Customer" duplicate
USING "Customer" existing
WHERE lower(duplicate."customerEmail") = lower(existing."customerEmail")
  AND duplicate."customerID" > existing."customerID";

CREATE UNIQUE INDEX "Customer_customerEmail_lower_key"
ON "Customer" (lower("customerEmail"));
