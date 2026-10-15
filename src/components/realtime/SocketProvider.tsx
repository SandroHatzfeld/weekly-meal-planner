"use client"

import type { PlanEvents } from "@/lib/realtime"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"

const SocketContext = createContext<Socket | null>(null)

export const useSocket = () => useContext(SocketContext)

// abonniert ein Event aus dem Plan-Room; handler darf sich zwischen Renders ändern
export const usePlanEvent = <E extends keyof PlanEvents>(event: E, handler: (payload: PlanEvents[E]) => void) => {
	const socket = useSocket()
	const handlerRef = useRef(handler)
	useEffect(() => {
		handlerRef.current = handler
	})
	useEffect(() => {
		if (!socket) return
		const listener = (payload: PlanEvents[E]) => handlerRef.current(payload)
		socket.on(event as string, listener)
		return () => {
			socket.off(event as string, listener)
		}
	}, [socket, event])
}

export default function SocketProvider({ planId, children }: { planId: string; children: React.ReactNode }) {
	const router = useRouter()
	const [socket, setSocket] = useState<Socket | null>(null)

	useEffect(() => {
		const connection = io({
			// bei jedem (Re-)Connect ein frisches Ticket holen -> Membership wird jedes Mal neu geprüft
			auth: (callback) => {
				fetch("/api/socket/ticket")
					.then((response) => (response.ok ? response.json() : null))
					.then((data: { ticket?: string } | null) => callback({ ticket: data?.ticket }))
					.catch(() => callback({}))
			},
		})

		connection.on("disconnect", (reason) => {
			// Server hat getrennt (aus Plan entfernt / Plan verlassen) -> neu laden, Fallback-Plan greift
			if (reason === "io server disconnect") window.location.reload()
		})
		connection.on("connect_error", (error) => {
			if (error.message === "unauthorized") setTimeout(() => window.location.reload(), 2000)
		})
		// Änderungen, die keine eigene Client-Logik haben -> Server-Komponenten neu rendern
		connection.on("plan-changed", () => router.refresh())
		connection.on("member-removed", () => router.refresh())
		connection.on("grocery-lists-changed", () => router.refresh())

		// erst nach erfolgreichem Handshake bereitstellen
		connection.once("connect", () => setSocket(connection))
		return () => {
			connection.disconnect()
			setSocket(null)
		}
	}, [planId, router])

	return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}
