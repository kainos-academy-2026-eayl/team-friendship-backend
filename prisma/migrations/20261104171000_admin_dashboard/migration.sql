CREATE TYPE "CustomerRole" AS ENUM ('CUSTOMER', 'ADMIN');

ALTER TABLE "Customer"
ADD COLUMN "role" "CustomerRole" NOT NULL DEFAULT 'CUSTOMER';

ALTER TABLE "OrderService"
ADD COLUMN "unitPrice" DECIMAL(10, 2);

UPDATE "OrderService" AS order_service
SET "unitPrice" = product."productPrice"::DECIMAL(10, 2)
FROM "Product" AS product
WHERE product."productID" = order_service."productID";

ALTER TABLE "OrderService"
ALTER COLUMN "unitPrice" SET NOT NULL;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_productStock_nonnegative_check"
CHECK ("productStock" >= 0);
