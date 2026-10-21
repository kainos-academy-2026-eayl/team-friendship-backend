-- CreateTable
CREATE TABLE "Customer" (
    "customerID" SERIAL NOT NULL,
    "customerForename" TEXT NOT NULL,
    "customerSurname" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerPassword" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("customerID")
);
