-- AlterTable
ALTER TABLE "GroceryList" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- bisherige Reihenfolge (nach Anlagedatum) übernehmen
UPDATE "GroceryList" l SET "position" = ranked.position
FROM (
	SELECT "id", (row_number() OVER (PARTITION BY "planId" ORDER BY "createdAt", "id") - 1)::int AS position FROM "GroceryList"
) ranked
WHERE ranked."id" = l."id";
