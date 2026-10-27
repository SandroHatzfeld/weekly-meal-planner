"use client"

import { dismissHint } from "@/lib/user/hints"
import { createContext, useContext, useState, type ReactNode } from "react"

type HintsContext = { dismissed: string[]; dismiss: (key: string) => void }

const Context = createContext<HintsContext>({ dismissed: [], dismiss: () => {} })

// weggeklickte Einmal-Hinweise des Nutzers (aus der Datenbank), sofort ausgeblendet und im Hintergrund gespeichert
export function HintsProvider({ dismissed: initial, children }: { dismissed: string[]; children: ReactNode }) {
	const [dismissed, setDismissed] = useState(initial)
	// nach dem Zurücksetzen in den Einstellungen kommt eine neue Liste vom Server
	// (nur bei geändertem Inhalt, sonst würde jedes Neuladen ein gerade weggeklicktes Häkchen überschreiben)
	const key = initial.join()
	const [seen, setSeen] = useState(key)
	if (key !== seen) {
		setSeen(key)
		setDismissed(initial)
	}
	const dismiss = (key: string) => {
		setDismissed((current) => [...current, key])
		void dismissHint(key).catch(() => {})
	}
	return <Context.Provider value={{ dismissed, dismiss }}>{children}</Context.Provider>
}

// Einmal-Hinweis: wird angezeigt, bis er mit „Verstanden“ weggeklickt wird
export default function Hint({ id, title, children }: { id: string; title: string; children: ReactNode }) {
	const { dismissed, dismiss } = useContext(Context)
	if (dismissed.includes(id)) return null
	return (
		<aside aria-label={title} className="rounded-lg border border-emerald-600/40 bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
			<div className="flex items-start gap-3">
				<div className="flex-1 space-y-1">
					<p className="font-semibold">{title}</p>
					{children}
				</div>
				<button type="button" className="btn shrink-0 min-h-11" onClick={() => dismiss(id)}>
					Verstanden
				</button>
			</div>
		</aside>
	)
}
