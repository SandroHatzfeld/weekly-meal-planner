"use client"

import Link from "next/link"
import { mainTabUrl, SETTINGS_TABS, showTab, TABS, tabGroupOf } from "@/lib/tabs"
import { usePathname, useRouter } from "next/navigation"

// Tab-Leiste der Kopfzeile: Haupt-Tabs, in den Einstellungen deren Tabs (Plan, Konto) mit „Zurück“
export default function TabBar() {
	const pathname = usePathname()
	const router = useRouter()
	const inSettings = pathname.startsWith("/settings")
	const tabs = inSettings ? SETTINGS_TABS : TABS
	const group = tabGroupOf(pathname)

	return (
		<nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
			{inSettings && (
				<Link
					href="/shop"
					className="border-b-2 border-transparent px-2 py-2 text-sm whitespace-nowrap"
					onClick={(event) => {
						// zurück zum zuletzt gezeigten Haupt-Tab (mit Liste, Monat, Filter)
						event.preventDefault()
						router.push(mainTabUrl())
					}}
				>
					← Zurück
				</Link>
			)}
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
