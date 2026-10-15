import { signOut } from "@/lib/auth/auth"
import PlanSwitcher from "./PlanSwitcher"
import TabBar from "./TabBar"

type TopBarProps = {
	plans: { id: string; name: string }[]
	activePlanId: string
	userName: string
}

export default function TopBar({ plans, activePlanId, userName }: TopBarProps) {
	const topBarTabs: Tabs[] = [
		{ tabName: "Woche", tabTarget: "/week" },
		{ tabName: "Monat", tabTarget: "/month" },
		{ tabName: "Einkaufen", tabTarget: "/shop" },
		{ tabName: "Rezepte", tabTarget: "/recipes" },
		{ tabName: "Einstellungen", tabTarget: "/settings" },
	]

	return (
		<header className="border-b border-black/10 bg-white/70 dark:border-white/10 dark:bg-black/30">
			<div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
				<h1 className="text-lg font-semibold">Mealplanner</h1>
				<PlanSwitcher plans={plans} activePlanId={activePlanId} />
				<div className="ml-auto flex items-center gap-3 text-sm">
					<span className="opacity-70">{userName}</span>
					<form
						action={async () => {
							"use server"
							await signOut({ redirectTo: "/login" })
						}}
					>
						<button type="submit" className="btn-link">
							Abmelden
						</button>
					</form>
				</div>
			</div>
			<TabBar tabs={topBarTabs} />
		</header>
	)
}
