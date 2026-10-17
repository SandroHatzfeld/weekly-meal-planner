-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "defaultListId" TEXT;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_defaultListId_fkey" FOREIGN KEY ("defaultListId") REFERENCES "GroceryList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

