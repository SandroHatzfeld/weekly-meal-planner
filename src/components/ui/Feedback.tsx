"use client"

import Modal from "@/components/ui/Modal"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

// Einheitliches Feedback der App: kurze Meldungen unten am Rand (auch mit Rückgängig) und Bestätigungs-Popups
// im App-Design statt window.confirm().

type Toast = { id: number; message: string; tone: "info" | "error"; action?: { label: string; onClick: () => void } }
type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean }
type Pending = { run: () => Promise<void>; timer: ReturnType<typeof setTimeout>; beacon?: Beacon }
// Zustellung beim Verlassen der Seite (normale Anfragen bricht der Browser dann ab)
type Beacon = { url: string; data: unknown }

type Feedback = {
	// kurze Meldung; Fehler bleiben etwas länger stehen
	notify: (message: string, options?: { tone?: "info" | "error"; action?: Toast["action"] }) => void
	// Löschen o.ä. erst nach kurzer Zeit ausführen, bis dahin rückgängig machbar. Die Oberfläche hat die Änderung
	// schon vorweggenommen; onUndo stellt sie wieder her (auch wenn die Ausführung fehlschlägt).
	undoable: (options: { message: string; run: () => Promise<unknown>; onUndo: () => void; errorMessage?: string; beacon?: Beacon }) => void
	// Bestätigung im App-Design; liefert true bei Bestätigung
	confirm: (options: ConfirmOptions) => Promise<boolean>
	// Aktion ausführen; bei einem Fehler Meldung zeigen und undefined liefern
	attempt: <T>(action: () => Promise<T>, errorMessage?: string) => Promise<T | undefined>
}

const FeedbackContext = createContext<Feedback | null>(null)

export const useFeedback = () => {
	const feedback = useContext(FeedbackContext)
	if (!feedback) throw new Error("useFeedback außerhalb von FeedbackProvider")
	return feedback
}

const UNDO_MS = 5000
const INFO_MS = 3000
const ERROR_MS = 6000
const GENERIC_ERROR = "Das hat nicht geklappt. Bitte erneut versuchen."

export default function FeedbackProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([])
	const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null)
	const nextId = useRef(1)
	const pending = useRef(new Map<number, Pending>())

	const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

	const show = useCallback(
		(toast: Omit<Toast, "id">, duration: number) => {
			const id = nextId.current++
			// höchstens drei Meldungen gleichzeitig
			setToasts((current) => [...current.slice(-2), { ...toast, id }])
			setTimeout(() => dismiss(id), duration)
			return id
		},
		[dismiss],
	)

	const notify = useCallback<Feedback["notify"]>(
		(message, options = {}) => {
			const tone = options.tone ?? "info"
			show({ message, tone, action: options.action }, tone === "error" ? ERROR_MS : INFO_MS)
		},
		[show],
	)

	const undoable = useCallback<Feedback["undoable"]>(
		({ message, run, onUndo, errorMessage, beacon }) => {
			const execute = async () => {
				try {
					await run()
				} catch {
					onUndo()
					notify(errorMessage ?? GENERIC_ERROR, { tone: "error" })
				}
			}
			let id = 0
			const timer = setTimeout(() => {
				pending.current.delete(id)
				void execute()
			}, UNDO_MS)
			id = show(
				{
					message,
					tone: "info",
					action: {
						label: "Rückgängig",
						onClick: () => {
							clearTimeout(timer)
							pending.current.delete(id)
							onUndo()
						},
					},
				},
				UNDO_MS,
			)
			pending.current.set(id, { run: execute, timer, beacon })
		},
		[notify, show],
	)

	// App wird verlassen oder in den Hintergrund geschickt: ausstehende Aktionen sofort ausführen, nicht verlieren
	useEffect(() => {
		const flush = () => {
			for (const [id, entry] of pending.current) {
				clearTimeout(entry.timer)
				pending.current.delete(id)
				const sent = entry.beacon && navigator.sendBeacon(entry.beacon.url, new Blob([JSON.stringify(entry.beacon.data)], { type: "application/json" }))
				if (!sent) void entry.run()
			}
		}
		const onVisibility = () => document.hidden && flush()
		window.addEventListener("pagehide", flush)
		document.addEventListener("visibilitychange", onVisibility)
		return () => {
			window.removeEventListener("pagehide", flush)
			document.removeEventListener("visibilitychange", onVisibility)
		}
	}, [])

	const confirm = useCallback<Feedback["confirm"]>((options) => new Promise((resolve) => setDialog({ ...options, resolve })), [])

	const attempt = useCallback<Feedback["attempt"]>(
		async (action, errorMessage) => {
			try {
				return await action()
			} catch (error) {
				// Weiterleitungen und andere Steuer-Ausnahmen von Next.js nicht verschlucken
				if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_")) throw error
				notify(errorMessage ?? GENERIC_ERROR, { tone: "error" })
				return undefined
			}
		},
		[notify],
	)

	const value = useMemo(() => ({ notify, undoable, confirm, attempt }), [notify, undoable, confirm, attempt])

	const close = (result: boolean) => {
		dialog?.resolve(result)
		setDialog(null)
	}

	return (
		<FeedbackContext.Provider value={value}>
			{children}
			{/* Meldungen unten mittig, über der Tastatur-/Gestenleiste */}
			<div
				aria-live="polite"
				className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
			>
				{toasts.map((toast) => (
					<div
						key={toast.id}
						role={toast.tone === "error" ? "alert" : "status"}
						className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg px-4 py-2 text-sm text-white shadow-lg ${toast.tone === "error" ? "bg-red-700" : "bg-neutral-800 dark:bg-neutral-700"}`}
					>
						<span className="flex-1">{toast.message}</span>
						{toast.action && (
							<button
								type="button"
								className="-my-2 min-h-11 shrink-0 font-semibold text-emerald-300 uppercase"
								onClick={() => {
									toast.action?.onClick()
									dismiss(toast.id)
								}}
							>
								{toast.action.label}
							</button>
						)}
					</div>
				))}
			</div>
			<Modal open={!!dialog} onClose={() => close(false)} labelledBy="confirm-title">
				{dialog && (
					<div className="space-y-4 p-4">
						<h2 id="confirm-title" className="text-lg font-semibold">
							{dialog.title}
						</h2>
						{dialog.message && <p className="text-sm whitespace-pre-line opacity-80">{dialog.message}</p>}
						<div className="flex justify-end gap-2">
							<button type="button" className="btn-secondary min-h-11" onClick={() => close(false)}>
								Abbrechen
							</button>
							<button type="button" className={`${dialog.danger ? "btn-danger-solid" : "btn"} min-h-11`} onClick={() => close(true)} autoFocus>
								{dialog.confirmLabel ?? "OK"}
							</button>
						</div>
					</div>
				)}
			</Modal>
		</FeedbackContext.Provider>
	)
}
