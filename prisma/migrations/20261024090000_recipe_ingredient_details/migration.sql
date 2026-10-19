-- Menge und Einheit einer Rezept-Zutat werden zu einem freien Feld "details" (z.B. "400 ml").
-- Bestehende Werte werden mit einem Leerzeichen zusammengeführt; Zahlen mit Komma wie in der Anzeige.

-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN "details" TEXT;

UPDATE "RecipeIngredient"
SET "details" = NULLIF(
	trim(concat_ws(' ', replace(trim_scale("amount"::numeric)::text, '.', ','), NULLIF(trim("unit"), ''))),
	''
);

ALTER TABLE "RecipeIngredient" DROP COLUMN "amount",
DROP COLUMN "unit";
