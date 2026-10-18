// Schlüssel für die gelernte Zuordnung Produkt -> Kategorie. Muss zur Migration grocery_categories passen
// (lower + Whitespace zusammenfassen). Läuft auch im Browser.
export const normalizeItemName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase()
