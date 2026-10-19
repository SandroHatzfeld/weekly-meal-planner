import { randomBytes } from "crypto"
import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import path from "path"
import { prisma } from "./prisma"
import { FetchError, safeFetch } from "./safeFetch"

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

export const downloadImage = async (rawUrl: string) => {
	try {
		const { body } = await safeFetch(rawUrl, { accept: "image/*", maxBytes: MAX_IMAGE_BYTES, what: "Bild" })
		return saveImage(body)
	} catch (error) {
		if (error instanceof FetchError) throw new ImageError(error.message)
		throw error
	}
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
