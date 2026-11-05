-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "providerRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRequestId_key" ON "Payment"("providerRequestId");
