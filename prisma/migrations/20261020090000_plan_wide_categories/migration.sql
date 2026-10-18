-- Kategorien und Produkt-Gedächtnis gelten künftig für den ganzen Plan; nur die Reihenfolge im Laden bleibt pro Liste.
-- Gleichnamige Kategorien der Listen eines Plans werden zusammengeführt (bevorzugt die der Standardliste).

ALTER TABLE "GroceryCategory" ADD COLUMN "planId" TEXT;
UPDATE "GroceryCategory" c SET "planId" = l."planId" FROM "GroceryList" l WHERE l."id" = c."listId";

CREATE TEMP TABLE category_map AS
SELECT c."id" AS old_id, c."listId", c."planId", c."name", c."position",
	first_value(c."id") OVER (
		PARTITION BY c."planId", c."name"
		ORDER BY (c."listId" = p."defaultListId") DESC NULLS LAST, c."position", c."id"
	) AS new_id
FROM "GroceryCategory" c
JOIN "Plan" p ON p."id" = c."planId";

-- Reihenfolge je Liste: eigene Kategorien in bisheriger Reihenfolge, Kategorien anderer Listen dahinter
CREATE TABLE "GroceryListCategory" (
    "listId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GroceryListCategory_pkey" PRIMARY KEY ("listId","categoryId")
);

INSERT INTO "GroceryListCategory" ("listId", "categoryId", "position")
SELECT l."id", canon.new_id,
	(row_number() OVER (PARTITION BY l."id" ORDER BY own.position IS NULL, own.position, canon."position", canon."name") - 1)::int
FROM "GroceryList" l
JOIN category_map canon ON canon."planId" = l."planId" AND canon.old_id = canon.new_id
LEFT JOIN LATERAL (
	SELECT min(m."position") AS position FROM category_map m WHERE m."listId" = l."id" AND m.new_id = canon.new_id
) own ON true;

UPDATE "GroceryItem" i SET "categoryId" = m.new_id FROM category_map m WHERE i."categoryId" = m.old_id AND m.old_id <> m.new_id;

-- Produkte: eine Zeile pro Plan und Produkt; Schreibweise der letzten Nutzung, Kategorie der letzten Zuordnung
CREATE TABLE "GroceryProduct" (
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "categoryId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryProduct_pkey" PRIMARY KEY ("planId","name")
);

INSERT INTO "GroceryProduct" ("planId", "name", "displayName", "categoryId", "usedAt")
SELECT DISTINCT ON (l."planId", g."name") l."planId", g."name", g."displayName",
	(
		SELECT m.new_id
		FROM "GroceryCategoryMemory" g2
		JOIN "GroceryList" l2 ON l2."id" = g2."listId"
		JOIN category_map m ON m.old_id = g2."categoryId"
		WHERE l2."planId" = l."planId" AND g2."name" = g."name"
		ORDER BY g2."usedAt" DESC
		LIMIT 1
	),
	g."usedAt"
FROM "GroceryCategoryMemory" g
JOIN "GroceryList" l ON l."id" = g."listId"
ORDER BY l."planId", g."name", g."usedAt" DESC;

DROP TABLE "GroceryCategoryMemory";

DELETE FROM "GroceryCategory" c USING category_map m WHERE c."id" = m.old_id AND m.old_id <> m.new_id;
DROP TABLE category_map;

ALTER TABLE "GroceryCategory" DROP CONSTRAINT "GroceryCategory_listId_fkey";
DROP INDEX "GroceryCategory_listId_position_idx";
ALTER TABLE "GroceryCategory" DROP COLUMN "listId",
DROP COLUMN "position",
ALTER COLUMN "planId" SET NOT NULL;

CREATE INDEX "GroceryListCategory_listId_position_idx" ON "GroceryListCategory"("listId", "position");
CREATE UNIQUE INDEX "GroceryCategory_planId_name_key" ON "GroceryCategory"("planId", "name");

ALTER TABLE "GroceryCategory" ADD CONSTRAINT "GroceryCategory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroceryListCategory" ADD CONSTRAINT "GroceryListCategory_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroceryListCategory" ADD CONSTRAINT "GroceryListCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GroceryCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroceryProduct" ADD CONSTRAINT "GroceryProduct_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroceryProduct" ADD CONSTRAINT "GroceryProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GroceryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
