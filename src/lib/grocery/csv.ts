// CSV für Produkte und ihre Kategorien – bearbeitbar in Excel/LibreOffice/Numbers.
// Format: Produkt;Kategorie 1;Kategorie 2;…  (Reihenfolge der Kategorien = Vorrang)

const HEADER = "Produkt"

// Excel (de) schreibt Semikolon, andere Programme Komma oder Tab: am Kopf bzw. der ersten Zeile erkennen
const detectDelimiter = (text: string) => {
	const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
	const [best] = [";", ",", "\t"]
		.map((delimiter) => ({ delimiter, fields: firstLine.split(delimiter).length }))
		.sort((a, b) => b.fields - a.fields)
	return best.fields > 1 ? best.delimiter : ";"
}

// RFC-4180-artig: Felder in Anführungszeichen dürfen Trenner, Zeilenumbrüche und "" enthalten
export const parseCsv = (text: string): string[][] => {
	const input = text.replace(/^﻿/, "")
	const delimiter = detectDelimiter(input)
	const rows: string[][] = []
	let row: string[] = []
	let field = ""
	let quoted = false
	for (let i = 0; i < input.length; i++) {
		const char = input[i]
		if (quoted) {
			if (char === '"' && input[i + 1] === '"') {
				field += '"'
				i++
			} else if (char === '"') quoted = false
			else field += char
		} else if (char === '"' && field === "") quoted = true
		else if (char === delimiter) {
			row.push(field)
			field = ""
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && input[i + 1] === "\n") i++
			row.push(field)
			rows.push(row)
			row = []
			field = ""
		} else field += char
	}
	if (field !== "" || row.length > 0) {
		row.push(field)
		rows.push(row)
	}
	return rows
}

const escapeField = (value: string) => (/[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

// mit BOM, damit Excel Umlaute als UTF-8 erkennt
export const toCsv = (rows: string[][]) => "﻿" + rows.map((row) => row.map(escapeField).join(";")).join("\r\n") + "\r\n"

export type ProductRow = { displayName: string; aliases: string[]; categories: string[] }

const ALIASES_HEADER = "Alternative Namen"
const ALIAS_SEPARATOR = " | "

// Format: Produkt;Alternative Namen;Kategorie 1;Kategorie 2;… (Alternativen mit " | " getrennt)
export const productsToCsv = (products: ProductRow[]) => {
	const columns = Math.max(3, ...products.map((product) => product.categories.length))
	const header = [HEADER, ALIASES_HEADER, ...Array.from({ length: columns }, (_, index) => `Kategorie ${index + 1}`)]
	const rows = [...products]
		.sort((a, b) => a.displayName.localeCompare(b.displayName, "de"))
		.map((product) => [
			product.displayName,
			product.aliases.join(ALIAS_SEPARATOR),
			...Array.from({ length: columns }, (_, index) => product.categories[index] ?? ""),
		])
	return toCsv([header, ...rows])
}

// leere Zeilen und Zellen werden übersprungen. Die Kopfzeile bestimmt das Format: mit Spalte "Alternative Namen" (neu)
// oder ohne (älterer Export: Produkt;Kategorie 1;…). Ohne Kopfzeile gilt das ältere Format.
export const parseProductCsv = (text: string): ProductRow[] => {
	const rows = parseCsv(text).map((row) => row.map((cell) => cell.trim()))
	let withAliases = false
	if (rows[0]?.[0]?.toLowerCase() === HEADER.toLowerCase()) {
		withAliases = rows[0][1]?.toLowerCase() === ALIASES_HEADER.toLowerCase()
		rows.shift()
	}
	return rows
		.filter((row) => row[0])
		.map((row) => {
			const [displayName, ...rest] = row
			const aliases = withAliases ? (rest.shift() ?? "").split("|").map((alias) => alias.trim()).filter(Boolean) : []
			return { displayName, aliases, categories: rest.filter(Boolean) }
		})
}
