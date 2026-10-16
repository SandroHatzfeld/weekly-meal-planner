import { auth } from "@/lib/auth/auth"
import { ImageError, MAX_IMAGE_BYTES, saveImage } from "@/lib/images"
import { NextResponse } from "next/server"

// Upload aus dem Bildfeld (Rezept/Gericht) – multipart mit Feld "file"
export async function POST(request: Request) {
	const session = await auth()
	if (!session?.user?.id) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 })

	const formData = await request.formData().catch(() => null)
	const file = formData?.get("file")
	if (!(file instanceof File)) return NextResponse.json({ error: "Keine Datei" }, { status: 400 })
	if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Das Bild ist größer als 10 MB" }, { status: 413 })

	try {
		const url = await saveImage(Buffer.from(await file.arrayBuffer()))
		return NextResponse.json({ url }, { status: 201 })
	} catch (error) {
		if (error instanceof ImageError) return NextResponse.json({ error: error.message }, { status: 400 })
		throw error
	}
}
