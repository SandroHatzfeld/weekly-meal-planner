"use client"

import Dropdown from "@/components/ui/Dropdown"
import { switchPlan } from "@/lib/plan/actions"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

const NEW_PLAN = "__new"

export default function PlanSwitcher({ plans, activePlanId }: { plans: { id: string; name: string }[]; activePlanId: string }) {
	const router = useRouter()
	const [pending, startTransition] = useTransition()

	return (
		<Dropdown
			label="Plan wechseln"
			value={activePlanId}
			options={[...plans.map((plan) => ({ value: plan.id, label: plan.name })), { value: NEW_PLAN, label: "+ Neuer Plan…" }]}
			className={`max-w-48 min-w-0 ${pending ? "opacity-60" : ""}`}
			align="left"
			onChange={(value) => {
				if (value === NEW_PLAN) return router.push("/onboarding")
				if (value === activePlanId) return
				startTransition(async () => {
					await switchPlan(value)
					router.refresh()
				})
			}}
		/>
	)
}
