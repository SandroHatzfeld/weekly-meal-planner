import { Prisma } from "../../../generated/prisma/client"
import { prisma } from "../../prisma"
import { FetchError, safeFetch } from "../../safeFetch"
import { extractPage, normalizeUrl, type ExtractedPage } from "./extract"
import { LlmError, structureRecipe, validateRecipe, type ImportedRecipe } from "./llm"

const MAX_PAGE_BYTES = 2 * 1024 * 1024
const CACHE_DAYS = 30
const FETCH_LIMIT = 40
const LLM_LIMIT = 20

export class ImportError extends Error {}

// einfaches Limit pro Nutzer gegen Missbrauch (Kosten): in-memory genügt für eine einzelne Instanz
const attempts = new Map<string, number[]>()
const checkRateLimit = (kind: "fetch" | "llm", userId: string, limit: number) => {
	const since = Date.now() - 3_600_000
	const key = `${kind}:${userId}`
	const recent = (attempts.get(key) ?? []).filter((time) => time > since)
	if (recent.length >= limit) throw new ImportError("Zu viele Importe in der letzten Stunde – bitte später erneut versuchen")
	attempts.set(key, [...recent, Date.now()])
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

const toUrl = (rawUrl: string) => {
	try {
		return normalizeUrl(rawUrl)
	} catch {
		throw new ImportError("Bitte gib einen gültigen Link ein")
	}
}

const asImportError = (error: unknown) => (error instanceof FetchError || error instanceof LlmError ? new ImportError(error.message) : error)

// Schritt 1: Seite laden und Rohdaten zwischenspeichern. ready = das aufbereitete Rezept liegt schon im Cache.
// refresh = Cache ignorieren (Seite neu laden und neu aufbereiten)
export const prepareImport = async (userId: string, rawUrl: string, refresh = false): Promise<{ ready: boolean }> => {
	const url = toUrl(rawUrl)
	// alte Einträge nebenbei aufräumen
	await prisma.recipeImportCache.deleteMany({ where: { fetchedAt: { lt: new Date(Date.now() - CACHE_DAYS * 86_400_000) } } })

	const cached = refresh ? null : await prisma.recipeImportCache.findUnique({ where: { url } })
	if (cached?.result) {
		try {
			validateRecipe(cached.result)
			return { ready: true }
		} catch {
			// unbrauchbarer Cache-Eintrag: neu aufbereiten
		}
	}
	if (cached) return { ready: false } // Rohdaten vorhanden, nur die Aufbereitung fehlt

	checkRateLimit("fetch", userId, FETCH_LIMIT)
	try {
		const extracted = (await loadPage(url)) as unknown as Prisma.InputJsonValue
		await prisma.recipeImportCache.upsert({
			where: { url },
			create: { url, extracted },
			update: { extracted, result: Prisma.JsonNull, model: null, fetchedAt: new Date() },
		})
		return { ready: false }
	} catch (error) {
		throw asImportError(error)
	}
}

// Schritt 2: Rezept aus den zwischengespeicherten Rohdaten vom Sprachmodell aufbereiten lassen
export const finishImport = async (userId: string, rawUrl: string): Promise<{ recipe: ImportedRecipe; sourceUrl: string; cached: boolean }> => {
	const url = toUrl(rawUrl)
	const entry = await prisma.recipeImportCache.findUnique({ where: { url } })
	if (!entry) throw new ImportError("Die Seite wurde noch nicht geladen – bitte den Import erneut starten")
	if (entry.result) {
		try {
			return { recipe: validateRecipe(entry.result), sourceUrl: url, cached: true }
		} catch {
			// unbrauchbar: neu aufbereiten
		}
	}

	checkRateLimit("llm", userId, LLM_LIMIT)
	try {
		const { recipe, model } = await structureRecipe(entry.extracted as unknown as ExtractedPage)
		await prisma.recipeImportCache.update({ where: { url }, data: { result: recipe as unknown as Prisma.InputJsonValue, model } })
		return { recipe, sourceUrl: url, cached: false }
	} catch (error) {
		throw asImportError(error)
	}
}
