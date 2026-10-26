import WeekPage from "./week/page"

// nach dem Neuladen einer anderen Tab-Seite: dieser Tab mit Standardwerten (ohne Adressparameter)
export default function Default() {
	return <WeekPage params={Promise.resolve({})} searchParams={Promise.resolve({})} />
}
