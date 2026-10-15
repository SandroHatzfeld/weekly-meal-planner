import type { Server } from "socket.io"
import type { DishDTO, GroceryItemDTO } from "./dto"

// server.js legt die Socket.io-Instanz auf globalThis ab – Next.js läuft im selben Prozess
const getIO = () => (globalThis as unknown as { __wmpIO?: Server }).__wmpIO

export type PlanEvents = {
	"dish-created": DishDTO
	"dish-updated": DishDTO
	"dish-deleted": { id: string }
	"grocery-item-created": GroceryItemDTO
	"grocery-item-updated": GroceryItemDTO
	"grocery-item-checked": { listId: string; id: string; checked: boolean }
	"grocery-item-moved": { id: string; fromListId: string; toListId: string; item: GroceryItemDTO }
	"grocery-item-deleted": { listId: string; id: string }
	"grocery-lists-changed": { planId: string }
	"member-removed": { userId: string; reason: "left" | "removed" }
	"plan-changed": { planId: string }
}

export const emitToPlan = <E extends keyof PlanEvents>(planId: string, event: E, payload: PlanEvents[E]) => {
	getIO()?.to(`plan:${planId}`).emit(event, payload)
}

// trennt alle offenen Verbindungen (alle Tabs) eines Nutzers
export const disconnectUser = (userId: string) => {
	getIO()?.in(`user:${userId}`).disconnectSockets(true)
}
