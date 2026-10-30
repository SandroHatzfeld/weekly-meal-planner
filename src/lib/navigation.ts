// true, sobald in diesem Tab innerhalb der App navigiert wurde. Bei direktem Aufruf (Link aus einer Nachricht,
// neuer Tab, Neuladen) ist der vorige Verlaufseintrag keine App-Seite: „Zurück“ braucht dann ein festes Ziel.
let navigated = false

export const markInAppNavigation = () => {
	navigated = true
}

export const canGoBackInApp = () => navigated
