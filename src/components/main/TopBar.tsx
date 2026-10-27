import { signOut } from "@/lib/auth/auth"
import Link from "next/link"
import HeaderHeight from "./HeaderHeight"
import PlanSwitcher from "./PlanSwitcher"
import TabBar from "./TabBar"
import OfflineBanner from "@/components/pwa/OfflineBanner"

type TopBarProps = {
	plans: { id: string; name: string }[]
	activePlanId: string
	userName: string
}

export default function TopBar({ plans, activePlanId, userName }: TopBarProps) {
	const topBarTabs: Tabs[] = [
		{ tabName: "Einkaufsliste", tabTarget: "/shop" },
		{ tabName: "Woche", tabTarget: "/week" },
		{ tabName: "Monat", tabTarget: "/month" },
		{ tabName: "Rezepte", tabTarget: "/recipes" },
	]

	return (
		<header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/95">
			<div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
				<h1 className="text-lg font-semibold">Mealplanner</h1>
				<PlanSwitcher plans={plans} activePlanId={activePlanId} />
				<div className="ml-auto flex items-center gap-3 text-sm">
					<span className="hidden opacity-70 sm:inline">{userName}</span>
					<Link href="/settings" aria-label="Einstellungen" title="Einstellungen" className="-my-2 flex size-11 items-center justify-center text-inherit opacity-70 hover:opacity-100">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
							<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					</Link>
					<form
						className="hidden sm:block"
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
			<div className="mx-auto max-w-5xl px-4 empty:hidden">
				<OfflineBanner />
			</div>
			<HeaderHeight />
		</header>
	)
}
