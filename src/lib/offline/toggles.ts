"use client"

import { useSyncExternalStore } from "react"
import { toggleGroceryItem } from "@/lib/grocery/actions"

// Abhaken ohne Netz: Der Wunschzustand wird im Gerät gemerkt (pro Eintrag gilt der letzte) und gesendet, sobald wieder Verbindung besteht.
const KEY = "wmp-pending-toggles"
const CHANGED = "wmp-pending-changed"

type Pending = Record<string, boolean> // itemId -> checked

const read = (): Pending => {
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}")
		return parsed && typeof parsed === "object" ? parsed : {}
	} catch {
		return {}
	}
}

const write = (pending: Pending) => {
	try {
		if (Object.keys(pending).length) localStorage.setItem(KEY, JSON.stringify(pending))
		else localStorage.removeItem(KEY)
	} catch {}
	window.dispatchEvent(new Event(CHANGED))
}

export const pendingToggles = read

export const clearPendingToggles = () => write({})

// Verbindungsfehler (Server nicht erreichbar) von echten Fehlern der Action unterscheiden
const isNetworkError = (error: unknown) => !navigator.onLine || error instanceof TypeError

// Abhaken senden; ohne Verbindung wird es gemerkt. Liefert false, wenn es noch aussteht.
export const sendToggle = async (itemId: string, checked: boolean) => {
	try {
		if (!navigator.onLine) throw new TypeError("offline")
		await toggleGroceryItem(itemId, checked)
		const pending = read()
		if (itemId in pending) {
			delete pending[itemId]
			write(pending)
		}
		return true
	} catch (error) {
		if (!isNetworkError(error)) throw error
		write({ ...read(), [itemId]: checked })
		return false
	}
}

let flushing = false

// gemerkte Änderungen nacheinander senden; bei erneutem Verbindungsfehler bleibt der Rest für später liegen
export const flushToggles = async () => {
	if (flushing) return
	flushing = true
	try {
		for (const [itemId, checked] of Object.entries(read())) {
			try {
				await toggleGroceryItem(itemId, checked)
			} catch (error) {
				if (isNetworkError(error)) return
				// z.B. Eintrag wurde inzwischen gelöscht: nichts mehr zu tun
			}
			const pending = read()
			delete pending[itemId]
			write(pending)
		}
	} finally {
		flushing = false
	}
}

const subscribe = (callback: () => void) => {
	window.addEventListener(CHANGED, callback)
	window.addEventListener("storage", callback)
	window.addEventListener("online", callback)
	window.addEventListener("offline", callback)
	return () => {
		window.removeEventListener(CHANGED, callback)
		window.removeEventListener("storage", callback)
		window.removeEventListener("online", callback)
		window.removeEventListener("offline", callback)
	}
}

// Anzahl noch nicht gesendeter Änderungen (als String, damit der Snapshot stabil bleibt)
const countSnapshot = () => String(Object.keys(read()).length)

export const usePendingCount = () => Number(useSyncExternalStore(subscribe, countSnapshot, () => "0"))

export const useOnline = () =>
	useSyncExternalStore(
		subscribe,
		() => navigator.onLine,
		() => true,
	)
