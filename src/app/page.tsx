import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function Dashboard() {
	const currentSession = await auth()
	if (!currentSession || !currentSession.user) {
		redirect("/login")
	} 

	const isUserOnboarded = await prisma.planMember.findFirst({where: { userId: currentSession.user?.id}})
	if(!isUserOnboarded) {
		redirect("/onboarding")
	}

	return <div>{currentSession.user?.email}</div>
}
