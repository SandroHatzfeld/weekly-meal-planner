"use client"

import { useFeedback } from "@/components/ui/Feedback"
import { resetHints } from "@/lib/user/hints"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

// alle weggeklickten Einmal-Hinweise wieder anzeigen
export default function ResetHintsButton({ dismissedCount }: { dismissedCount: number }) {
	const router = useRouter()
	const { attempt, notify } = useFeedback()
	const [pending, startTransition] = useTransition()
	return (
		<button
			type="button"
			className="btn-secondary min-h-11"
			disabled={pending || dismissedCount === 0}
			onClick={() =>
				startTransition(async () => {
					if ((await attempt(() => resetHints().then(() => true))) === undefined) return
					router.refresh()
					notify("Hinweise werden wieder angezeigt")
				})
			}
		>
			{dismissedCount === 0 ? "Alle Hinweise werden angezeigt" : "Hinweise wieder anzeigen"}
		</button>
	)
}
