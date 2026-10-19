// Dish.date wird immer als UTC-Mitternacht gespeichert, damit es keine Zeitzonen-Verschiebungen gibt.

export const toDateKey = (date: Date) => date.toISOString().slice(0, 10)

export const parseDateKey = (key: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
	if (!match) return null
	const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
	return Number.isNaN(date.getTime()) ? null : date
}

// "Heute" gilt in der Zeitzone der App (APP_TIMEZONE, Standard Europe/Berlin), nicht in der des Servers – der läuft meist in UTC,
// sodass nach Mitternacht noch der Vortag gelten würde.
export const todayKey = () => {
	const timeZone = (typeof process !== "undefined" && process.env.APP_TIMEZONE) || "Europe/Berlin"
	try {
		return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
	} catch {
		const now = new Date()
		return toDateKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
	}
}

// vergangene Tage lassen sich nicht mehr belegen (Schlüssel "YYYY-MM-DD" sind als Text vergleichbar)
export const isPastDay = (key: string) => key < todayKey()

export const PAST_DAY_MESSAGE = "Vergangene Tage können nicht mehr geplant werden"

export const addDays = (key: string, days: number) => {
	const date = parseDateKey(key)!
	date.setUTCDate(date.getUTCDate() + days)
	return toDateKey(date)
}

// Montag der Woche, in der das Datum liegt
export const startOfWeek = (key: string) => {
	const date = parseDateKey(key)!
	const weekday = (date.getUTCDay() + 6) % 7
	return addDays(key, -weekday)
}

export const formatDay = (key: string, options: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat("de-DE", { ...options, timeZone: "UTC" }).format(parseDateKey(key)!)
