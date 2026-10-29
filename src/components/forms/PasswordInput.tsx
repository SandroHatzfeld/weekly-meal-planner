"use client"

import Icon from "@/components/ui/Icon"
import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react"

// Passwortfeld mit Auge zum Anzeigen des Textes
export default function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
	const [visible, setVisible] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	// Cursorposition beim Umschalten merken: der Browser setzt sie beim Wechsel des Typs an den Anfang
	const selection = useRef<[number, number] | null>(null)
	useLayoutEffect(() => {
		const range = selection.current
		const element = input.current
		selection.current = null
		if (!range || !element || document.activeElement !== element) return
		element.setSelectionRange(...range)
		// manche Browser setzen die Auswahl erst nach dem Zeichnen zurück
		requestAnimationFrame(() => element.setSelectionRange(...range))
	}, [visible])
	return (
		<div className="relative">
			<input {...props} ref={input} type={visible ? "text" : "password"} className={`${className} pr-11!`} />
			<button
				type="button"
				className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center opacity-70 hover:opacity-100"
				aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
				aria-pressed={visible}
				aria-controls={props.id}
				// Fokus (und Tastatur) bleibt im Eingabefeld
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => {
					const element = input.current
					if (element?.selectionStart != null) selection.current = [element.selectionStart, element.selectionEnd ?? element.selectionStart]
					setVisible(!visible)
				}}
			>
				{/* zeigt den Zustand: durchgestrichen = ausgeblendet */}
				<Icon name={visible ? "eye" : "eyeOff"} className="size-5" />
			</button>
		</div>
	)
}
