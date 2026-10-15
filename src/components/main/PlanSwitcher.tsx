"use client"

import { switchPlan } from "@/lib/plan/actions"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

const NEW_PLAN = "__new"

export default function PlanSwitcher({ plans, activePlanId }: { plans: { id: string; name: string }[]; activePlanId: string }) {
	const router = useRouter()
	const [pending, startTransition] = useTransition()

	return (
		<select
			aria-label="Plan wechseln"
			className="input w-auto"
			value={activePlanId}
			disabled={pending}
			onChange={(event) => {
				const value = event.target.value
				if (value === NEW_PLAN) return router.push("/onboarding")
				startTransition(async () => {
					await switchPlan(value)
					router.refresh()
				})
			}}
		>
			{plans.map((plan) => (
				<option key={plan.id} value={plan.id}>
					{plan.name}
				</option>
			))}
			<option value={NEW_PLAN}>+ Neuer Plan…</option>
		</select>
	)
}
