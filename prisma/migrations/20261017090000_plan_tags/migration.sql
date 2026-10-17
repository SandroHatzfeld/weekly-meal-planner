-- CreateTable
CREATE TABLE "PlanTag" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GroceryItemToPlanTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GroceryItemToPlanTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GroceryItemToPlanTag_B_index" ON "_GroceryItemToPlanTag"("B");

-- AddForeignKey
ALTER TABLE "PlanTag" ADD CONSTRAINT "PlanTag_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroceryItemToPlanTag" ADD CONSTRAINT "_GroceryItemToPlanTag_A_fkey" FOREIGN KEY ("A") REFERENCES "GroceryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroceryItemToPlanTag" ADD CONSTRAINT "_GroceryItemToPlanTag_B_fkey" FOREIGN KEY ("B") REFERENCES "PlanTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Standard-Tags für bestehende Pläne (neue Pläne bekommen sie beim Anlegen)
INSERT INTO "PlanTag" ("id", "planId", "name", "icon", "createdAt")
SELECT gen_random_uuid()::text, p."id", t."name", t."icon", CURRENT_TIMESTAMP + t."offset" * INTERVAL '1 millisecond'
FROM "Plan" p
CROSS JOIN (VALUES ('Aktion', 'flame', 0), ('Angebot', 'percent', 1), ('App', 'smartphone', 2)) AS t("name", "icon", "offset");
