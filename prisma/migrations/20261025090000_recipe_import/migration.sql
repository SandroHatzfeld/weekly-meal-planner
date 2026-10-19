-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "RecipeImportCache" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extracted" JSONB NOT NULL,
    "result" JSONB,
    "model" TEXT,

    CONSTRAINT "RecipeImportCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeImportCache_url_key" ON "RecipeImportCache"("url");

