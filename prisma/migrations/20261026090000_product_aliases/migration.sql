-- CreateTable
CREATE TABLE "GroceryProductAlias" (
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,

    CONSTRAINT "GroceryProductAlias_pkey" PRIMARY KEY ("planId","name")
);

-- CreateIndex
CREATE INDEX "GroceryProductAlias_planId_productName_idx" ON "GroceryProductAlias"("planId", "productName");

-- AddForeignKey
ALTER TABLE "GroceryProductAlias" ADD CONSTRAINT "GroceryProductAlias_planId_productName_fkey" FOREIGN KEY ("planId", "productName") REFERENCES "GroceryProduct"("planId", "name") ON DELETE CASCADE ON UPDATE CASCADE;

