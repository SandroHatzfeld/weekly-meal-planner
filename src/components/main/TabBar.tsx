"use client"

import Link from "next/link"
import { SETTINGS_TABS, showTab, TABS, tabGroupOf } from "@/lib/tabs"
import { usePathname } from "next/navigation"

// Tab-Leiste der Kopfzeile: Haupt-Tabs, in den Einstellungen deren Tabs (Plan, Konto)
export default function TabBar() {
	const pathname = usePathname()
	const tabs = pathname.startsWith("/settings") ? SETTINGS_TABS : TABS
	const group = tabGroupOf(pathname)

	return (
		<nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
			{tabs.map((tab) => {
				const active = pathname.startsWith(tab.href)
				return (
					<Link
						key={tab.href}
						href={tab.href}
						onClick={(event) => {
							// innerhalb einer Tab-Gruppe: die Seiten sind im Karussell schon da, nur hinübergleiten
							if (!group?.some((candidate) => candidate.href === tab.href) || event.metaKey || event.ctrlKey || event.shiftKey) return
							event.preventDefault()
							showTab(tab.href)
						}}
						className={`flex-1 whitespace-nowrap border-b-2 px-2 py-2 text-center sm:flex-none sm:px-3 text-sm text-inherit hover:no-underline ${active ? "border-emerald-600 font-semibold" : "border-transparent opacity-70 hover:opacity-100"}`}
					>
						{tab.name}
					</Link>
				)
			})}
		</nav>
	)
}
