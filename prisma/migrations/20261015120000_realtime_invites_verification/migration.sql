-- DropForeignKey
ALTER TABLE "_GroceryItemToPlan" DROP CONSTRAINT "_GroceryItemToPlan_A_fkey";

-- DropForeignKey
ALTER TABLE "_GroceryItemToPlan" DROP CONSTRAINT "_GroceryItemToPlan_B_fkey";

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3);

-- bestehende Accounts gelten als verifiziert (vor Einführung der Verifizierung angelegt)
UPDATE "User" SET "emailVerified" = "createdAt";

-- DropTable
DROP TABLE "_GroceryItemToPlan";

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PlanInvite_planId_key" ON "PlanInvite"("planId") WHERE (type = 'GENERIC' AND status = 'PENDING');

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Default nur für bestehende Zeilen benötigt, danach setzt Prisma @updatedAt
ALTER TABLE "Dish" ALTER COLUMN "updatedAt" DROP DEFAULT;
