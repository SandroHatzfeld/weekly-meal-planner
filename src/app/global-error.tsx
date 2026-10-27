"use client"

// letzte Rückfallebene, falls sogar das Grundlayout nicht geladen werden kann
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
	return (
		<html lang="de">
			<body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "3rem 1rem" }}>
				<h1>Da ist etwas schiefgelaufen</h1>
				<p>Die App konnte nicht geladen werden.</p>
				<button type="button" onClick={retry} style={{ padding: "0.6rem 1.1rem", marginTop: "1rem" }}>
					Erneut versuchen
				</button>
			</body>
		</html>
	)
}
