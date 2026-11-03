CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordResetToken_customerEmail_fkey"
        FOREIGN KEY ("customerEmail")
        REFERENCES "Customer"("customerEmail")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key"
    ON "PasswordResetToken"("tokenHash");

CREATE INDEX "PasswordResetToken_customerEmail_idx"
    ON "PasswordResetToken"("customerEmail");
