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

	return (
		<SocketProvider key={planId} planId={planId}>
			<TopBar plans={plans} activePlanId={planId} userName={user.name ?? ""} />
			<main className="mx-auto w-full max-w-5xl flex-1 p-4">
				{children}
			</main>
		</SocketProvider>
	)
}
