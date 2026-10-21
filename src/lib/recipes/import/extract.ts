// Rohdaten aus einer Rezeptseite holen – ohne LLM und ohne zusätzliche Bibliothek.
// 1. schema.org/Recipe als JSON-LD (die meisten Kochseiten liefern das), 2. Fallback: Titel, Meta-Angaben und Seitentext.

export type ExtractedPage =
	| { kind: "jsonld"; recipe: Record<string, unknown>; pageTitle: string }
	| { kind: "text"; text: string; pageTitle: string; imageUrl: string | null; description: string | null }

const MAX_TEXT = 20_000

const decodeEntities = (text: string) =>
	text
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))

const isRecipeType = (value: unknown) => (Array.isArray(value) ? value : [value]).some((type) => type === "Recipe")

// JSON-LD kann ein Objekt, ein Array oder ein @graph sein
const findRecipe = (node: unknown): Record<string, unknown> | null => {
	if (Array.isArray(node)) {
		for (const entry of node) {
			const found = findRecipe(entry)
			if (found) return found
		}
		return null
	}
	if (node && typeof node === "object") {
		const object = node as Record<string, unknown>
		if (isRecipeType(object["@type"])) return object
		return findRecipe(object["@graph"])
	}
	return null
}

const metaContent = (html: string, key: string) => {
	for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
		if (new RegExp(`(?:property|name)\\s*=\\s*["']${key}["']`, "i").test(tag)) {
			const content = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)
			if (content) return decodeEntities(content[1] ?? content[2] ?? "").trim() || null
		}
	}
	return null
}

const visibleText = (html: string) => {
	const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html
	return decodeEntities(
		body
			.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, " ")
			.replace(/<!--[\s\S]*?-->/g, " ")
			.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
			.replace(/<[^>]+>/g, " "),
	)
		.replace(/[ \t\f\v]+/g, " ")
		.replace(/ ?\n ?/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim()
		.slice(0, MAX_TEXT)
}

// schema.org-Dauer (ISO 8601, z.B. "PT1H30M", "P1DT2H") in Minuten; null bei fehlenden oder unlesbaren Werten
export const isoDurationMinutes = (value: unknown): number | null => {
	const match = typeof value === "string" ? /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i.exec(value.trim()) : null
	if (!match) return null
	const minutes = Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
	return minutes > 0 ? minutes : null
}

export const extractPage = (html: string): ExtractedPage => {
	const pageTitle = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim() || metaContent(html, "og:title") || ""

	for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
		try {
			const recipe = findRecipe(JSON.parse(match[1].trim()))
			if (recipe) return { kind: "jsonld", recipe, pageTitle }
		} catch {
			// kaputtes JSON-LD ignorieren, nächstes Skript probieren
		}
	}

	return {
		kind: "text",
		text: visibleText(html),
		pageTitle,
		imageUrl: metaContent(html, "og:image"),
		description: metaContent(html, "og:description") ?? metaContent(html, "description"),
	}
}

// gleiche Seite, gleicher Schlüssel: ohne Fragment, Tracking-Parameter und abschließenden Slash, Host klein
export const normalizeUrl = (rawUrl: string) => {
	const url = new URL(rawUrl.trim())
	url.hash = ""
	for (const key of [...url.searchParams.keys()]) {
		if (/^(utm_|fbclid$|gclid$|mc_|ref$)/i.test(key)) url.searchParams.delete(key)
	}
	url.searchParams.sort()
	url.hostname = url.hostname.toLowerCase()
	if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "")
	return url.toString()
}
