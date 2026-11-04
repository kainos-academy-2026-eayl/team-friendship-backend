/*
  Warnings:

  - Added the required column `productCategory` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "refreshTokenId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productCategory" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_refreshTokenId_fkey" FOREIGN KEY ("refreshTokenId") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
