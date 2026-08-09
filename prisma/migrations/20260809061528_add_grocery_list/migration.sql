/*
  Warnings:

  - You are about to drop the column `planId` on the `GroceryItem` table. All the data in the column will be lost.
  - Added the required column `listId` to the `GroceryItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GroceryItem" DROP CONSTRAINT "GroceryItem_planId_fkey";

-- AlterTable
ALTER TABLE "GroceryItem" DROP COLUMN "planId",
ADD COLUMN     "listId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "GroceryList" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GroceryItemToPlan" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GroceryItemToPlan_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GroceryItemToPlan_B_index" ON "_GroceryItemToPlan"("B");

-- AddForeignKey
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroceryItemToPlan" ADD CONSTRAINT "_GroceryItemToPlan_A_fkey" FOREIGN KEY ("A") REFERENCES "GroceryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroceryItemToPlan" ADD CONSTRAINT "_GroceryItemToPlan_B_fkey" FOREIGN KEY ("B") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
