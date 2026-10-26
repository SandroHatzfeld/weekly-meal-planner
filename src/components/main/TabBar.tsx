"use client"

import Link from "next/link"
import { showTab, TAB_PATHS } from "@/lib/tabs"
import { usePathname } from "next/navigation"

export default function TabBar({ tabs }: { tabs: Tabs[] }) {
	const pathname = usePathname()

	return (
		<nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
			{tabs.map((tab) => {
				const active = pathname.startsWith(tab.tabTarget)
				return (
					<Link
						key={tab.tabTarget}
						href={tab.tabTarget}
						onClick={(event) => {
							// zwischen den Haupt-Tabs: die Seiten sind im Karussell schon da, nur hinübergleiten
							if (!TAB_PATHS.includes(pathname) || !TAB_PATHS.includes(tab.tabTarget) || event.metaKey || event.ctrlKey || event.shiftKey) return
							event.preventDefault()
							showTab(tab.tabTarget)
						}}
						className={`flex-1 whitespace-nowrap border-b-2 px-2 py-2 text-center sm:flex-none sm:px-3 text-sm text-inherit hover:no-underline ${active ? "border-emerald-600 font-semibold" : "border-transparent opacity-70 hover:opacity-100"}`}
					>
						{tab.tabName}
					</Link>
				)
			})}
		</nav>
	)
}
