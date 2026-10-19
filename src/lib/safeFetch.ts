import { lookup } from "dns/promises"
import { BlockList, isIP } from "net"

// Abruf fremder URLs (Bilder, Rezeptseiten) mit Schutz gegen SSRF: keine Requests ins interne Netz
// (Docker-Netz, Router, Loopback, Cloud-Metadaten), Weiterleitungen werden einzeln geprüft, Größe und Dauer sind begrenzt.

export class FetchError extends Error {}

const blockedRanges = new BlockList()
for (const [network, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.168.0.0", 16],
	["224.0.0.0", 3],
] as const) {
	blockedRanges.addSubnet(network, prefix, "ipv4")
}
for (const [network, prefix] of [
	["::", 128],
	["::1", 128],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
] as const) {
	blockedRanges.addSubnet(network, prefix, "ipv6")
}

const isPublicAddress = (address: string) => {
	const family = isIP(address)
	if (family === 0) return false
	// IPv4-mapped IPv6 (::ffff:10.0.0.1) wie IPv4 behandeln
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
	if (mapped) return !blockedRanges.check(mapped[1], "ipv4")
	return !blockedRanges.check(address, family === 4 ? "ipv4" : "ipv6")
}

const assertPublicUrl = async (url: URL, what: string) => {
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError("Nur http- und https-Links sind erlaubt")
	const hostname = url.hostname.replace(/^\[|\]$/g, "")
	const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true }).catch(() => [])
	if (addresses.length === 0) throw new FetchError(`Die Adresse ${what === "Bild" ? "des Bildes" : "der Seite"} konnte nicht aufgelöst werden`)
	// nur für automatisierte Tests mit lokalen Fake-Servern; im Betrieb nie setzen
	if (process.env.SAFE_FETCH_ALLOW_PRIVATE === "1") return
	if (!addresses.every(({ address }) => isPublicAddress(address))) {
		throw new FetchError(`${what === "Bild" ? "Bilder" : "Seiten"} aus dem lokalen Netzwerk können nicht geladen werden`)
	}
}

const readLimited = async (response: Response, maxBytes: number, tooBig: string) => {
	const reader = response.body?.getReader()
	if (!reader) throw new FetchError("Leere Antwort")
	const chunks: Uint8Array[] = []
	let size = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.length
		if (size > maxBytes) {
			await reader.cancel()
			throw new FetchError(tooBig)
		}
		chunks.push(value)
	}
	return Buffer.concat(chunks)
}

type SafeFetchOptions = {
	accept: string
	maxBytes: number
	// Wort für Fehlermeldungen: "Bild" oder "Seite"
	what: "Bild" | "Seite"
	timeoutMs?: number
	// nur Antworten mit passendem Content-Type zulassen (z.B. /html/)
	contentType?: RegExp
}

export const safeFetch = async (rawUrl: string, options: SafeFetchOptions) => {
	let url: URL
	try {
		url = new URL(rawUrl)
	} catch {
		throw new FetchError(`Ungültige ${options.what === "Bild" ? "Bild-URL" : "URL"}`)
	}
	const loadError = `${options.what === "Bild" ? "Das Bild" : "Die Seite"} konnte nicht geladen werden`
	const tooBig = options.what === "Bild" ? `Das Bild ist größer als ${options.maxBytes / 1024 / 1024} MB` : "Die Seite ist zu groß"

	// Weiterleitungen manuell folgen, damit jedes Ziel geprüft wird
	for (let redirects = 0; redirects <= 3; redirects++) {
		await assertPublicUrl(url, options.what)
		const response = await fetch(url, {
			redirect: "manual",
			signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
			headers: { Accept: options.accept, "User-Agent": "WeeklyMealPlanner/1.0" },
		}).catch(() => {
			throw new FetchError(loadError)
		})

		const location = response.headers.get("location")
		if (response.status >= 300 && response.status < 400 && location) {
			url = new URL(location, url)
			continue
		}
		if (!response.ok) throw new FetchError(`${loadError} (HTTP ${response.status})`)
		const type = response.headers.get("content-type") ?? ""
		if (options.contentType && !options.contentType.test(type)) throw new FetchError(`Unter diesem Link gibt es keine ${options.what === "Seite" ? "Webseite" : "Bilddatei"}`)
		return { body: await readLimited(response, options.maxBytes, tooBig), url, contentType: type }
	}
	throw new FetchError("Zu viele Weiterleitungen")
}
