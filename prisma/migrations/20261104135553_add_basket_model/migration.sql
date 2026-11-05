-- CreateTable
CREATE TABLE "Basket" (
    "basketID" SERIAL NOT NULL,
    "customerID" INTEGER NOT NULL,
    "productID" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "Basket_pkey" PRIMARY KEY ("basketID")
);

-- CreateIndex
CREATE INDEX "Basket_customerID_idx" ON "Basket"("customerID");

-- CreateIndex
CREATE INDEX "Basket_productID_idx" ON "Basket"("productID");

-- AddForeignKey
ALTER TABLE "Basket" ADD CONSTRAINT "Basket_customerID_fkey" FOREIGN KEY ("customerID") REFERENCES "Customer"("customerID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Basket" ADD CONSTRAINT "Basket_productID_fkey" FOREIGN KEY ("productID") REFERENCES "Product"("productID") ON DELETE RESTRICT ON UPDATE CASCADE;
