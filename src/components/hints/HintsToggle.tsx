"use client"

import { useFeedback } from "@/components/ui/Feedback"
import { setHintsEnabled } from "@/lib/user/hints"
import { useRouter } from "next/navigation"
import { useOptimistic, useTransition } from "react"

// Einmal-Hinweise zur Bedienung ein- oder ausschalten (gilt für das Konto auf allen Geräten)
export default function HintsToggle({ enabled }: { enabled: boolean }) {
	const router = useRouter()
	const { attempt } = useFeedback()
	const [pending, startTransition] = useTransition()
	const [shown, setShown] = useOptimistic(enabled)
	return (
		<label className="flex min-h-11 cursor-pointer items-center gap-3">
			<span className="flex-1">
				<span className="block font-semibold">Hinweise anzeigen</span>
				<span className="block text-sm opacity-70">Kurze Erklärungen zur Bedienung, z.B. auf der Einkaufsliste.</span>
			</span>
			<input
				type="checkbox"
				role="switch"
				className="peer sr-only"
				checked={shown}
				disabled={pending}
				onChange={(event) => {
					const next = event.target.checked
					startTransition(async () => {
						setShown(next)
						if ((await attempt(() => setHintsEnabled(next).then(() => true))) === undefined) return
						router.refresh()
					})
				}}
			/>
			{/* Schalter-Optik; Fokusrahmen über peer */}
			<span
				aria-hidden="true"
				className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-600 ${shown ? "bg-emerald-700" : "bg-neutral-300 dark:bg-neutral-600"}`}
			>
				<span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${shown ? "translate-x-5" : ""}`} />
			</span>
		</label>
	)
}
