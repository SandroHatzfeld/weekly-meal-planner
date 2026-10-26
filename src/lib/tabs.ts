// Haupt-Tabs in Reihenfolge der Kopfzeile und des Karussells
export const TABS = [
	{ name: "Einkaufsliste", href: "/shop" },
	{ name: "Woche", href: "/week" },
	{ name: "Monat", href: "/month" },
	{ name: "Rezepte", href: "/recipes" },
] as const

export const TAB_PATHS: string[] = TABS.map((tab) => tab.href)

// zuletzt gezeigte Adresse je Tab (mit Parametern wie ?list= oder ?month=), damit ein Wechsel zurück den Tab so zeigt, wie er war
const lastUrls = new Map<string, string>()

export const rememberTabUrl = (path: string, url: string) => lastUrls.set(path, url)

export const tabUrl = (path: string) => lastUrls.get(path) ?? path

// Tab wechseln, ohne Server-Anfrage: die Seiten sind schon gerendert, Next übernimmt die Adresse (usePathname)
export const showTab = (path: string) => {
	if (window.location.pathname === path) return
	window.history.pushState(null, "", tabUrl(path))
}
