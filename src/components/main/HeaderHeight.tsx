"use client"

import { useEffect, useRef } from "react"

// Schreibt die aktuelle Höhe der App-Kopfzeile nach --app-header-h,
// damit Seiten-Kopfzeilen (z.B. Rezept) direkt darunter kleben können.
export default function HeaderHeight() {
	const marker = useRef<HTMLSpanElement>(null)

	useEffect(() => {
		const header = marker.current?.closest("header")
		if (!header) return
		const update = () => document.documentElement.style.setProperty("--app-header-h", `${header.offsetHeight}px`)
		update()
		const observer = new ResizeObserver(update)
		observer.observe(header)
		return () => observer.disconnect()
	}, [])

	return <span ref={marker} hidden />
}
