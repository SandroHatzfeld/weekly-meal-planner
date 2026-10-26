import ShopPage from "./shop/page"

// nach dem Neuladen einer anderen Tab-Seite: dieser Tab mit Standardwerten (ohne Adressparameter)
export default function Default() {
	return <ShopPage params={Promise.resolve({})} searchParams={Promise.resolve({})} />
}
