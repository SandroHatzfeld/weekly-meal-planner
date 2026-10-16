import { auth } from "@/lib/auth/auth"
import { readImage } from "@/lib/images"

export async function GET(_request: Request, { params }: RouteContext<"/api/images/[name]">) {
	// nur für eingeloggte Nutzer – <img> schickt das Session-Cookie mit
	const session = await auth()
	if (!session?.user?.id) return new Response(null, { status: 401 })

	const image = await readImage((await params).name)
	if (!image) return new Response(null, { status: 404 })

	return new Response(new Uint8Array(image.buffer), {
		headers: {
			"Content-Type": image.contentType,
			// Dateinamen sind zufällig und werden nie überschrieben
			"Cache-Control": "private, max-age=31536000, immutable",
			"X-Content-Type-Options": "nosniff",
		},
	})
}
