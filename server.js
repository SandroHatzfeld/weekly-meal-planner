import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'

const app = next({ dev: process.env.NODE_ENV !== 'production'})
const handle = app.getRequestHandler()

app.prepare().then(() => {
	const httpServer = createServer((req, res) => handle(req,res))
	const io = new Server(httpServer)

	io.on('connection', (socket) => {
		// Room Logic, to implement
	})

	httpServer.listen(3000)
})