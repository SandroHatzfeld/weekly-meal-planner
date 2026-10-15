import { createHmac } from "crypto"

// Kurzlebiges, signiertes Ticket für den Socket.io-Handshake.
// server.js prüft nur die Signatur – die Mitgliedschaft wurde beim Ausstellen gegen die DB geprüft.
type TicketPayload =
	| { type: "plan"; userId: string; name: string; planId: string }
	| { type: "dish"; userId: string; name: string; dishId: string }

const TICKET_TTL_MS = 60_000

export const signTicket = (payload: TicketPayload) => {
	const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TICKET_TTL_MS })).toString("base64url")
	const signature = createHmac("sha256", process.env.AUTH_SECRET!).update(body).digest("base64url")
	return `${body}.${signature}`
}
