-- CreateTable
CREATE TABLE "Product" (
    "productID" SERIAL NOT NULL,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "productPrice" DOUBLE PRECISION NOT NULL,
    "productImage" TEXT NOT NULL,
    "productStock" INTEGER NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("productID")
);
