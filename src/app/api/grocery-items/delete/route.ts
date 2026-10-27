import { isMember } from "@/lib/api/external-auth"
import { auth } from "@/lib/auth/auth"
import { deleteItem, findItemWithPlan } from "@/lib/grocery/service"
import { NextResponse } from "next/server"

// Ausstehendes Löschen (noch rückgängig machbar), wenn die App geschlossen oder in den Hintergrund geschickt wird:
// kommt per navigator.sendBeacon, das der Browser auch beim Verlassen der Seite noch zustellt.
// Das Sitzungs-Cookie ist SameSite=Lax und wird bei fremden Seiten nicht mitgeschickt.
export async function POST(request: Request) {
	const session = await auth()
	if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
	const body = await request.json().catch(() => null)
	const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string").slice(0, 500) : []
	for (const id of ids) {
		const item = await findItemWithPlan(id)
		// schon gelöscht oder fremd: überspringen
		if (item && (await isMember(session.user.id, item.list.planId))) await deleteItem(item.list.planId, id)
	}
	return new NextResponse(null, { status: 204 })
}
