import { createServer } from 'http'
import { createHmac, timingSafeEqual } from 'crypto'
import next from 'next'
import { Server } from 'socket.io'

const port = parseInt(process.env.PORT || '3000', 10)
const app = next({ dev: process.env.NODE_ENV !== 'production' })
const handle = app.getRequestHandler()

// Tickets werden in src/lib/socket-ticket.ts signiert (nach Membership-Check gegen die DB)
const verifyTicket = (ticket) => {
	if (typeof ticket !== 'string') return null
	const [body, signature] = ticket.split('.')
	if (!body || !signature) return null
	const expected = createHmac('sha256', process.env.AUTH_SECRET).update(body).digest()
	const given = Buffer.from(signature, 'base64url')
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
		return payload.exp > Date.now() ? payload : null
	} catch {
		return null
	}
}

// dishId -> Map<socketId, { userId, name }>
const presence = new Map()

app.prepare().then(() => {
	const httpServer = createServer((req, res) => handle(req, res))
	const io = new Server(httpServer)
	// Zugriff aus Route Handlern / Server Actions (src/lib/realtime.ts)
	globalThis.__wmpIO = io

	const broadcastPresence = (dishId) => {
		const viewers = new Map()
		for (const viewer of presence.get(dishId)?.values() ?? []) viewers.set(viewer.userId, viewer)
		io.to(`dish:${dishId}`).emit('presence-update', { dishId, users: [...viewers.values()] })
	}

	const leaveDish = (socket, dishId) => {
		socket.leave(`dish:${dishId}`)
		const viewers = presence.get(dishId)
		if (!viewers?.delete(socket.id)) return
		if (viewers.size === 0) presence.delete(dishId)
		broadcastPresence(dishId)
	}

	io.use((socket, nextMiddleware) => {
		const ticket = verifyTicket(socket.handshake.auth?.ticket)
		if (!ticket || ticket.type !== 'plan') return nextMiddleware(new Error('unauthorized'))
		socket.data.user = { userId: ticket.userId, name: ticket.name }
		socket.data.planId = ticket.planId
		nextMiddleware()
	})

	io.on('connection', (socket) => {
		socket.join(`user:${socket.data.user.userId}`)
		socket.join(`plan:${socket.data.planId}`)
		socket.data.dishes = new Set()

		socket.on('dish:join', (dishTicket) => {
			const ticket = verifyTicket(dishTicket)
			if (!ticket || ticket.type !== 'dish' || ticket.userId !== socket.data.user.userId) return
			socket.join(`dish:${ticket.dishId}`)
			socket.data.dishes.add(ticket.dishId)
			if (!presence.has(ticket.dishId)) presence.set(ticket.dishId, new Map())
			presence.get(ticket.dishId).set(socket.id, socket.data.user)
			broadcastPresence(ticket.dishId)
		})

		socket.on('dish:leave', (dishId) => {
			if (!socket.data.dishes.delete(dishId)) return
			leaveDish(socket, dishId)
		})

		socket.on('disconnect', () => {
			for (const dishId of socket.data.dishes) leaveDish(socket, dishId)
		})
	})

	httpServer.listen(port, () => {
		console.log(`> Server läuft auf http://localhost:${port}`)
	})
})
