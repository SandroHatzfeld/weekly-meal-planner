import { randomBytes } from "crypto"
import { lookup } from "dns/promises"
import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import { BlockList, isIP } from "net"
import path from "path"
import { prisma } from "./prisma"

// Bilder liegen lokal auf dem Server (Docker: eigenes Volume) und werden über /api/images/<name> ausgeliefert.
// public/ geht nicht: Next.js liefert dort nur Dateien aus, die beim Build schon existierten.

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "data/uploads")
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const PUBLIC_PREFIX = "/api/images/"
const NAME_PATTERN = /^[A-Za-z0-9_-]{16,64}\.(jpg|png|webp|gif)$/

export class ImageError extends Error {}

const TYPES = {
	jpg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
} as const
type Extension = keyof typeof TYPES

// Dateityp anhand der Magic Bytes – Content-Type oder Dateiendung vom Client zählen nicht (kein SVG/HTML)
const detectExtension = (buffer: Buffer): Extension | null => {
	if (buffer.length < 12) return null
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg"
	if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png"
	if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp"
	if (buffer.toString("ascii", 0, 4) === "GIF8") return "gif"
	return null
}

export const isLocalImage = (value: string | null | undefined): value is string =>
	!!value && value.startsWith(PUBLIC_PREFIX) && NAME_PATTERN.test(value.slice(PUBLIC_PREFIX.length))

export const saveImage = async (buffer: Buffer) => {
	if (buffer.length > MAX_IMAGE_BYTES) throw new ImageError("Das Bild ist größer als 10 MB")
	const extension = detectExtension(buffer)
	if (!extension) throw new ImageError("Nur JPEG, PNG, WebP oder GIF werden unterstützt")

	const name = `${randomBytes(16).toString("base64url")}.${extension}`
	await mkdir(UPLOAD_DIR, { recursive: true })
	await writeFile(path.join(UPLOAD_DIR, name), buffer)
	return PUBLIC_PREFIX + name
}

export const readImage = async (name: string) => {
	if (!NAME_PATTERN.test(name)) return null
	try {
		const buffer = await readFile(path.join(UPLOAD_DIR, name))
		return { buffer, contentType: TYPES[name.split(".").pop() as Extension] }
	} catch {
		return null
	}
}

// --- Bilder von fremden URLs herunterladen ---

// Schutz gegen SSRF: keine Requests ins interne Netz (Docker-Netz, Router, Loopback, Cloud-Metadaten)
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

const assertPublicUrl = async (url: URL) => {
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new ImageError("Nur http- und https-Links sind erlaubt")
	const hostname = url.hostname.replace(/^\[|\]$/g, "")
	const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true }).catch(() => [])
	if (addresses.length === 0) throw new ImageError("Die Adresse des Bildes konnte nicht aufgelöst werden")
	if (!addresses.every(({ address }) => isPublicAddress(address))) {
		throw new ImageError("Bilder aus dem lokalen Netzwerk können nicht geladen werden")
	}
}

const readLimited = async (response: Response) => {
	const reader = response.body?.getReader()
	if (!reader) throw new ImageError("Leere Antwort")
	const chunks: Uint8Array[] = []
	let size = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.length
		if (size > MAX_IMAGE_BYTES) {
			await reader.cancel()
			throw new ImageError("Das Bild ist größer als 10 MB")
		}
		chunks.push(value)
	}
	return Buffer.concat(chunks)
}

export const downloadImage = async (rawUrl: string) => {
	let url: URL
	try {
		url = new URL(rawUrl)
	} catch {
		throw new ImageError("Ungültige Bild-URL")
	}

	// Weiterleitungen manuell folgen, damit jedes Ziel geprüft wird
	for (let redirects = 0; redirects <= 3; redirects++) {
		await assertPublicUrl(url)
		const response = await fetch(url, {
			redirect: "manual",
			signal: AbortSignal.timeout(10_000),
			headers: { Accept: "image/*", "User-Agent": "WeeklyMealPlanner/1.0" },
		}).catch(() => {
			throw new ImageError("Das Bild konnte nicht geladen werden")
		})

		const location = response.headers.get("location")
		if (response.status >= 300 && response.status < 400 && location) {
			url = new URL(location, url)
			continue
		}
		if (!response.ok) throw new ImageError(`Das Bild konnte nicht geladen werden (HTTP ${response.status})`)
		return saveImage(await readLimited(response))
	}
	throw new ImageError("Zu viele Weiterleitungen")
}

// Formularwert -> was in der DB landet: leer, bereits lokales Bild oder fremde URL (wird heruntergeladen)
export const resolveImageInput = async (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (isLocalImage(trimmed)) return trimmed
	return downloadImage(trimmed)
}

// wie resolveImageInput, aber Fehler als Formularmeldung statt Exception
export const resolveImage = async (value: string): Promise<{ imageUrl: string | null } | { error: string }> => {
	try {
		return { imageUrl: await resolveImageInput(value) }
	} catch (error) {
		if (error instanceof ImageError) return { error: error.message }
		throw error
	}
}

// löscht die Datei nur, wenn kein Rezept und kein Gericht (Snapshot beim Planen) sie noch nutzt
export const deleteImageIfUnused = async (imageUrl: string | null | undefined) => {
	if (!isLocalImage(imageUrl)) return
	const [recipes, dishes] = await Promise.all([
		prisma.recipe.count({ where: { imageUrl } }),
		prisma.dish.count({ where: { imageUrl } }),
	])
	if (recipes + dishes > 0) return
	await unlink(path.join(UPLOAD_DIR, imageUrl.slice(PUBLIC_PREFIX.length))).catch(() => {})
}
