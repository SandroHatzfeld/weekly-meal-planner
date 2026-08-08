"use server"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function page() {
	const currentSession = await auth()

	if (!currentSession) {
		redirect("/login")
	}

	return <div>{currentSession.user?.email}</div>
}
