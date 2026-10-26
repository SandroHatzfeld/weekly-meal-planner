import RecipesPage from "./recipes/page"

// nach dem Neuladen einer anderen Tab-Seite: dieser Tab mit Standardwerten (ohne Adressparameter)
export default function Default() {
	return <RecipesPage params={Promise.resolve({})} searchParams={Promise.resolve({})} />
}
