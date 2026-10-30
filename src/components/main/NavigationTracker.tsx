"use client"

import { markInAppNavigation } from "@/lib/navigation"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

// merkt sich, ob innerhalb der App navigiert wurde (dann führt „Zurück“ per Verlauf an die vorige App-Seite)
export default function NavigationTracker() {
	const pathname = usePathname()
	const first = useRef(pathname)
	useEffect(() => {
		if (pathname !== first.current) markInAppNavigation()
	}, [pathname])
	return null
}
