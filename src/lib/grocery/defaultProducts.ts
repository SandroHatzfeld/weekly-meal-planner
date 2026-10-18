// Vorbefüllung des Produkt-Gedächtnisses: gängige Produkte -> Kategorie aus DEFAULT_CATEGORIES.
// Bestehende Listen: Migration grocery_default_products (aus dieser Liste erzeugt), neue Listen: seedDefaultProducts().
export const DEFAULT_PRODUCTS: Record<string, string[]> = {
	"Obst & Gemüse": [
		"Äpfel", "Bananen", "Birnen", "Orangen", "Mandarinen", "Zitronen", "Limetten", "Weintrauben", "Erdbeeren",
		"Heidelbeeren", "Himbeeren", "Kiwi", "Ananas", "Mango", "Avocado", "Tomaten", "Cherrytomaten",
		"Gurke", "Paprika", "Zucchini", "Aubergine", "Karotten", "Kartoffeln", "Süßkartoffeln", "Zwiebeln",
		"Rote Zwiebeln", "Knoblauch", "Ingwer", "Brokkoli", "Blumenkohl", "Spinat", "Feldsalat", "Eisbergsalat",
		"Rucola", "Champignons", "Lauch", "Frühlingszwiebeln", "Kohlrabi", "Rotkohl", "Kürbis",
		"Petersilie", "Basilikum", "Schnittlauch", "Radieschen",
	],
	"Brot & Backwaren": [
		"Brot", "Vollkornbrot", "Toastbrot", "Brötchen", "Baguette", "Croissants", "Laugenbrezeln", "Knäckebrot",
		"Wraps", "Fladenbrot", "Burgerbrötchen",
	],
	"Kühlregal": [
		"Milch", "Hafermilch", "Buttermilch", "Butter", "Margarine", "Joghurt", "Naturjoghurt", "Griechischer Joghurt",
		"Quark", "Skyr", "Schlagsahne", "Kochsahne", "Saure Sahne", "Schmand", "Crème fraîche", "Frischkäse",
		"Mozzarella", "Feta", "Gouda", "Emmentaler", "Parmesan", "Reibekäse", "Hüttenkäse", "Mascarpone", "Eier",
		"Tofu", "Pudding", "Aufschnitt", "Salami", "Kochschinken", "Speck", "Hummus", "Gnocchi", "Frische Nudeln",
		"Blätterteig", "Pizzateig",
	],
	"Fleisch & Fisch": [
		"Hähnchenbrust", "Hähnchenschenkel", "Hackfleisch", "Rinderhack", "Schweinefilet", "Schnitzel", "Rindersteak",
		"Bratwurst", "Wiener Würstchen", "Putenbrust", "Lachsfilet", "Garnelen", "Kabeljau",
	],
	"Tiefkühl": [
		"Tiefkühlpizza", "Pommes", "Erbsen, tiefgekühlt", "Fischstäbchen", "Eis", "Tiefkühlbeeren", "Gemüsemischung",
		"Kräuter, tiefgekühlt", "Kroketten", "Rahmspinat",
	],
	"Vorrat": [
		"Nudeln", "Spaghetti", "Penne", "Reis", "Basmatireis", "Couscous", "Linsen", "Kichererbsen",
		"Kidneybohnen", "Mais", "Thunfisch", "Passierte Tomaten", "Gehackte Tomaten", "Tomatenmark", "Kokosmilch",
		"Gemüsebrühe", "Mehl", "Zucker", "Backpulver", "Hefe", "Haferflocken", "Müsli",
		"Cornflakes", "Honig", "Marmelade", "Nuss-Nougat-Creme", "Erdnussbutter", "Olivenöl", "Rapsöl", "Essig",
		"Senf", "Ketchup", "Mayonnaise", "Sojasauce", "Pesto", "Salz", "Pfeffer", "Paprikapulver",
		"Currypulver", "Oregano", "Zimt", "Kaffee", "Tee", "Kakao", "Schokolade", "Kekse", "Chips", "Nüsse", "Mandeln",
	],
	"Getränke": [
		"Wasser", "Mineralwasser", "Apfelsaft", "Orangensaft", "Apfelschorle", "Cola", "Limonade", "Eistee", "Bier",
		"Weißwein", "Rotwein", "Sekt",
	],
	"Drogerie": [
		"Toilettenpapier", "Küchenrolle", "Taschentücher", "Zahnpasta", "Zahnbürste", "Duschgel", "Shampoo", "Spülung",
		"Deo", "Handseife", "Spülmittel", "Spülmaschinentabs", "Waschmittel", "Weichspüler", "Müllbeutel", "Alufolie",
		"Frischhaltefolie", "Backpapier", "Gefrierbeutel", "Schwämme", "Allzweckreiniger", "WC-Reiniger", "Rasierer",
		"Sonnencreme", "Bodylotion",
	],
}
