"use client"

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"

type ModalProps = {
	open: boolean
	onClose: () => void
	// Sichtbarkeit folgt "open": zum Schließen ruft der Inhalt onClose() auf, der Aufrufer setzt open=false
	children: ReactNode
	widthClass?: string
	labelledBy?: string
	// Fokus auf das Popup selbst statt auf das erste Eingabefeld (auf dem Handy erscheint sonst gleich die Tastatur)
	focusDialog?: boolean
}

// Gemeinsamer Popup-Rahmen: natives <dialog> (Escape, Fokus), Portal an <body>,
// mobil oben angedockt, Hintergrund-Tipp schließt.
export default function Modal({ open, onClose, children, widthClass = "w-[min(26rem,calc(100%-2rem))]", labelledBy, focusDialog = false }: ModalProps) {
	const dialog = useRef<HTMLDialogElement>(null)
	const pressedOnBackdrop = useRef(false)
	// Portal erst im Browser (beim Server-Rendering gibt es kein document)
	const isClient = useSyncExternalStore(
		() => () => {},
		() => true,
		() => false,
	)

	useEffect(() => {
		if (open && !dialog.current?.open) {
			dialog.current?.showModal()
			if (focusDialog) dialog.current?.focus()
		}
		if (!open && dialog.current?.open) dialog.current.close()
	}, [open, isClient, focusDialog])

	if (!isClient) return null

	// Portal an <body>: Popups enthalten eigene Formulare und werden auch innerhalb anderer Formulare genutzt
	return createPortal(
		<dialog
			ref={dialog}
			aria-labelledby={labelledBy}
			tabIndex={focusDialog ? -1 : undefined}
			// nur das eigene Schließen: React reicht "close" verschachtelter Popups (Portal) im Baum nach oben weiter
			onClose={(event) => {
				if (event.target === dialog.current) onClose()
			}}
			// Klick auf den abgedunkelten Hintergrund schließt – aber nur, wenn der Druck dort auch begann.
			// Sonst würde das Loslassen nach dem Gedrückthalten einer Kachel das Popup sofort wieder schließen.
			onPointerDown={(event) => {
				pressedOnBackdrop.current = event.target === dialog.current
			}}
			onClick={(event) => {
				if (event.target === dialog.current && pressedOnBackdrop.current) dialog.current.close()
				pressedOnBackdrop.current = false
			}}
			// mobil oben andocken (Tastatur verdeckt sonst die Hälfte), ab sm mittig
			className={`mx-auto mt-3 mb-auto outline-none max-h-[calc(100dvh-1.5rem)] ${widthClass} overflow-y-auto rounded-xl border border-(--border) bg-(--surface) p-0 text-(--foreground) shadow-xl backdrop:bg-black/40 sm:my-auto`}
		>
			{open && children}
		</dialog>,
		document.body,
	)
}
