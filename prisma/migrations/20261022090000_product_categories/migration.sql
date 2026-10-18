-- Produkte können mehrere Kategorien in Reihenfolge haben (Haupt- + Ausweichkategorien).
-- Bisherige Zuordnung wird zur Hauptkategorie.

-- CreateTable
CREATE TABLE "GroceryProductCategory" (
    "planId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GroceryProductCategory_pkey" PRIMARY KEY ("planId","productName","categoryId")
);

INSERT INTO "GroceryProductCategory" ("planId", "productName", "categoryId", "position")
SELECT "planId", "name", "categoryId", 0 FROM "GroceryProduct" WHERE "categoryId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "GroceryProduct" DROP CONSTRAINT "GroceryProduct_categoryId_fkey";

-- AlterTable
ALTER TABLE "GroceryProduct" DROP COLUMN "categoryId";

-- AddForeignKey
ALTER TABLE "GroceryProductCategory" ADD CONSTRAINT "GroceryProductCategory_planId_productName_fkey" FOREIGN KEY ("planId", "productName") REFERENCES "GroceryProduct"("planId", "name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryProductCategory" ADD CONSTRAINT "GroceryProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GroceryCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
