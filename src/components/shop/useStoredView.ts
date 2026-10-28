"use client"

import { useSyncExternalStore } from "react"

export type ShopView = "planning" | "store" | "alpha"
const KEY = "wmp.shopView"
const EVENT = "wmp:shop-view"
const isView = (value: unknown): value is ShopView => value === "planning" || value === "store" || value === "alpha"

const read = (): ShopView => {
	try {
		const value = localStorage.getItem(KEY)
		return isView(value) ? value : "planning"
	} catch {
		return "planning"
	}
}

const subscribe = (callback: () => void) => {
	window.addEventListener(EVENT, callback)
	window.addEventListener("storage", callback)
	return () => {
		window.removeEventListener(EVENT, callback)
		window.removeEventListener("storage", callback)
	}
}

// Ansicht der Einkaufsliste pro Gerät merken; Server rendert immer "planning"
export const useStoredView = () => {
	const view = useSyncExternalStore(subscribe, read, () => "planning" as const)
	const setView = (next: ShopView) => {
		try {
			localStorage.setItem(KEY, next)
		} catch {
			// Speicher gesperrt (z.B. privater Modus): Auswahl lässt sich nicht merken
		}
		window.dispatchEvent(new Event(EVENT))
	}
	return [view, setView] as const
}

const SHOW_CHECKED_KEY = "wmp.showChecked"

const readShowChecked = () => {
	try {
		return localStorage.getItem(SHOW_CHECKED_KEY) === "1"
	} catch {
		return false
	}
}

// abgehakte Einträge einblenden (pro Gerät gemerkt); Server rendert sie ausgeblendet
export const useShowChecked = () => {
	const show = useSyncExternalStore(subscribe, readShowChecked, () => false)
	const setShow = (next: boolean) => {
		try {
			localStorage.setItem(SHOW_CHECKED_KEY, next ? "1" : "0")
		} catch {
			// Speicher gesperrt: gilt nur bis zum Neuladen nicht
		}
		window.dispatchEvent(new Event(EVENT))
	}
	return [show, setShow] as const
}
