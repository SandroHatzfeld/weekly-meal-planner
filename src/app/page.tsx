import TopBar from "@/components/main/TopBar"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function Dashboard() {
	const currentSession = await auth()

	const planMember = await prisma.planMember.findFirst({ where: { userId: currentSession!.user.id } })
	if (!planMember) {
		redirect("/onboarding")
	}

	// nutzer finden und direkt relationale werte mit abfragen
	const user = await prisma.user.findUnique({
		where: { id: currentSession!.user.id },
		include: {
			memberships: { take: 1 },
			activePlan: { include: { groceryLists: true } },
		},
	})

	if (!user || user.memberships.length === 0) {
		redirect("/onboarding")
	}

	if (!user.activePlan) return

	const activePlan = user.activePlan
	const planGroceryLists = activePlan.groceryLists
	
	return (
		<div>
			<TopBar currentPlan={activePlan?.name} />
			<div>
				<select>
					{planGroceryLists.map((list) => {
						return <option key={list.id}>{list.name}</option>
					})}
				</select>
				<h2>Diese Woche</h2>
				<div></div>
			</div>
		</div>
	)
}
