import type { Prisma } from "../../../generated/prisma/client"
import { prisma } from "../../prisma"
import { FetchError, safeFetch } from "../../safeFetch"
import { extractPage, normalizeUrl, type ExtractedPage } from "./extract"
import { LlmError, structureRecipe, validateRecipe, type ImportedRecipe } from "./llm"

const MAX_PAGE_BYTES = 2 * 1024 * 1024
const CACHE_DAYS = 30
const HOURLY_LIMIT = 20

export class ImportError extends Error {}

// einfaches Limit pro Nutzer gegen Missbrauch (Kosten): in-memory genügt für eine einzelne Instanz
const attempts = new Map<string, number[]>()
const checkRateLimit = (userId: string) => {
	const since = Date.now() - 3_600_000
	const recent = (attempts.get(userId) ?? []).filter((time) => time > since)
	if (recent.length >= HOURLY_LIMIT) throw new ImportError("Zu viele Importe in der letzten Stunde – bitte später erneut versuchen")
	attempts.set(userId, [...recent, Date.now()])
}

const loadPage = async (url: string): Promise<ExtractedPage> => {
	const { body } = await safeFetch(url, {
		accept: "text/html,application/xhtml+xml",
		maxBytes: MAX_PAGE_BYTES,
		what: "Seite",
		timeoutMs: 15_000,
		contentType: /html|xml/i,
	})
	return extractPage(body.toString("utf8"))
}

// refresh = Cache ignorieren (Seite neu laden und neu aufbereiten)
export const importRecipe = async (userId: string, rawUrl: string, refresh = false): Promise<{ recipe: ImportedRecipe; sourceUrl: string; cached: boolean }> => {
	let url: string
	try {
		url = normalizeUrl(rawUrl)
	} catch {
		throw new ImportError("Bitte gib einen gültigen Link ein")
	}

	// alte Einträge nebenbei aufräumen
	await prisma.recipeImportCache.deleteMany({ where: { fetchedAt: { lt: new Date(Date.now() - CACHE_DAYS * 86_400_000) } } })

	const cached = refresh ? null : await prisma.recipeImportCache.findUnique({ where: { url } })
	if (cached?.result) {
		try {
			return { recipe: validateRecipe(cached.result), sourceUrl: url, cached: true }
		} catch {
			// unbrauchbarer Cache-Eintrag: neu aufbereiten
		}
	}

	checkRateLimit(userId)
	try {
		// Rohdaten aus dem Cache nutzen, falls nur die Aufbereitung fehlt
		const page = cached && !refresh ? (cached.extracted as unknown as ExtractedPage) : await loadPage(url)
		const { recipe, model } = await structureRecipe(page)
		const data = { extracted: page as unknown as Prisma.InputJsonValue, result: recipe as unknown as Prisma.InputJsonValue, model, fetchedAt: new Date() }
		await prisma.recipeImportCache.upsert({ where: { url }, create: { url, ...data }, update: data })
		return { recipe, sourceUrl: url, cached: false }
	} catch (error) {
		if (error instanceof FetchError || error instanceof LlmError) throw new ImportError(error.message)
		throw error
	}
}
