import { NextResponse } from "next/server"
import { prisma } from "../prisma"
import { sha256 } from "../tokens"

// Eigener Auth-Mechanismus für /api/external/... – unabhängig von Auth.js/JWT-Cookies
export const authenticateToken = async (request: Request) => {
	const header = request.headers.get("authorization")
	const match = header && /^Bearer\s+(.+)$/i.exec(header)
	if (!match) return null

	const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash: sha256(match[1].trim()) } })
	if (!apiToken) return null

	await prisma.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
	return { userId: apiToken.userId }
}

// Autorisierung pro Request: aktuelle Mitgliedschaft gegen die DB prüfen
export const isMember = async (userId: string, planId: string) =>
	!!(await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId } } }))

export const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 })
export const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 })
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 })
