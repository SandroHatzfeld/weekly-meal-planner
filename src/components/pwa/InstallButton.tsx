"use client"

import { useEffect, useState } from "react"

type InstallPrompt = Event & { prompt: () => Promise<void> }

// "App installieren" (Chrome/Android/Desktop); iOS kennt das Ereignis nicht – dort geht es über Teilen → Zum Home-Bildschirm
export default function InstallButton() {
	const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
	useEffect(() => {
		const onPrompt = (event: Event) => {
			event.preventDefault()
			setPrompt(event as InstallPrompt)
		}
		const onInstalled = () => setPrompt(null)
		window.addEventListener("beforeinstallprompt", onPrompt)
		window.addEventListener("appinstalled", onInstalled)
		return () => {
			window.removeEventListener("beforeinstallprompt", onPrompt)
			window.removeEventListener("appinstalled", onInstalled)
		}
	}, [])
	if (!prompt) return null
	return (
		<button
			type="button"
			className="btn-secondary"
			onClick={async () => {
				await prompt.prompt()
				setPrompt(null)
			}}
		>
			App installieren
		</button>
	)
}
