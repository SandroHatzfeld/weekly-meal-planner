-- AlterTable
ALTER TABLE "GroceryItem" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "GroceryCategory" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GroceryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryCategoryMemory" (
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "categoryId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryCategoryMemory_pkey" PRIMARY KEY ("listId","name")
);

-- AddForeignKey
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GroceryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryCategory" ADD CONSTRAINT "GroceryCategory_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryCategoryMemory" ADD CONSTRAINT "GroceryCategoryMemory_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryCategoryMemory" ADD CONSTRAINT "GroceryCategoryMemory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GroceryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateIndex
CREATE INDEX "GroceryCategory_listId_position_idx" ON "GroceryCategory"("listId", "position");

-- Vorschlagsset für bestehende Listen (neue Listen bekommen es beim Anlegen, siehe DEFAULT_CATEGORIES)
INSERT INTO "GroceryCategory" ("id", "listId", "name", "position")
SELECT gen_random_uuid()::text, l."id", c."name", c."position"
FROM "GroceryList" l
CROSS JOIN (VALUES
  ('Obst & Gemüse', 0), ('Brot & Backwaren', 1), ('Kühlregal', 2), ('Fleisch & Fisch', 3),
  ('Tiefkühl', 4), ('Vorrat', 5), ('Getränke', 6), ('Drogerie', 7)
) AS c("name", "position");

-- bisherige Einträge als bekannte Produkte übernehmen (für Vorschläge); Normalisierung wie normalizeItemName()
INSERT INTO "GroceryCategoryMemory" ("listId", "name", "displayName", "usedAt")
SELECT DISTINCT ON (i."listId", lower(regexp_replace(btrim(i."name"), '\s+', ' ', 'g')))
  i."listId", lower(regexp_replace(btrim(i."name"), '\s+', ' ', 'g')), btrim(i."name"), i."createdAt"
FROM "GroceryItem" i
WHERE btrim(i."name") <> ''
ORDER BY i."listId", lower(regexp_replace(btrim(i."name"), '\s+', ' ', 'g')), i."createdAt" DESC;
