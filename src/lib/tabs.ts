// Haupt-Tabs in Reihenfolge der Kopfzeile und des Karussells
export const TABS = [
	{ name: "Einkaufsliste", href: "/shop" },
	{ name: "Woche", href: "/week" },
	{ name: "Monat", href: "/month" },
	{ name: "Rezepte", href: "/recipes" },
] as const

export const TAB_PATHS: string[] = TABS.map((tab) => tab.href)

// Einstellungen: eigene Tab-Gruppe mit derselben Mechanik (Karussell, Wischen)
export const SETTINGS_TABS = [
	{ name: "Plan", href: "/settings/plan" },
	{ name: "Konto", href: "/settings/account" },
] as const

export type Tab = { name: string; href: string }

// Tab-Gruppe, zu der eine Adresse gehört (Wechsel innerhalb einer Gruppe ohne Server-Anfrage)
export const tabGroupOf = (path: string): readonly Tab[] | null =>
	[TABS, SETTINGS_TABS].find((group) => group.some((tab) => tab.href === path)) ?? null

// zuletzt gezeigte Adresse je Tab (mit Parametern wie ?list= oder ?month=), damit ein Wechsel zurück den Tab so zeigt, wie er war
const lastUrls = new Map<string, string>()

// zuletzt gezeigter Haupt-Tab: Ziel von „Zurück“ aus den Einstellungen (übersteht auch ein Neuladen)
const MAIN_KEY = "wmp.lastMainTab"

export const rememberTabUrl = (path: string, url: string) => {
	lastUrls.set(path, url)
	if (!TAB_PATHS.includes(path)) return
	try {
		sessionStorage.setItem(MAIN_KEY, url)
	} catch {
		// Speicher gesperrt: „Zurück“ führt dann zur Einkaufsliste
	}
}

export const mainTabUrl = () => {
	try {
		return sessionStorage.getItem(MAIN_KEY) ?? "/shop"
	} catch {
		return "/shop"
	}
}

export const tabUrl = (path: string) => lastUrls.get(path) ?? path

// Tab wechseln, ohne Server-Anfrage: die Seiten sind schon gerendert, Next übernimmt die Adresse (usePathname)
export const showTab = (path: string) => {
	if (window.location.pathname === path) return
	window.history.pushState(null, "", tabUrl(path))
}
