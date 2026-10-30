import { HintsProvider } from "@/components/hints/Hints"
import NavigationTracker from "@/components/main/NavigationTracker"
import TopBar from "@/components/main/TopBar"
import SocketProvider from "@/components/realtime/SocketProvider"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"

export default async function AppLayout({ children }: LayoutProps<"/">) {
	const { user, planId } = await requireActivePlan()

	const memberships = await prisma.planMember.findMany({
		where: { userId: user.id },
		include: { plan: { select: { id: true, name: true } } },
		orderBy: { joinedAt: "asc" },
	})
	const plans = memberships.map((membership) => membership.plan)
	const { dismissedHints } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { dismissedHints: true } })

	return (
		<SocketProvider key={planId} planId={planId}>
			<TopBar plans={plans} activePlanId={planId} userName={user.name ?? ""} />
			<NavigationTracker />
			<main className="mx-auto w-full max-w-5xl flex-1 p-4">
				<HintsProvider dismissed={dismissedHints}>{children}</HintsProvider>
			</main>
		</SocketProvider>
	)
}
