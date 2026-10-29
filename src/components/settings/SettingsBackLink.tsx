"use client"

import { mainTabUrl } from "@/lib/tabs"
import Link from "next/link"
import { useRouter } from "next/navigation"

// zurück zum zuletzt gezeigten Haupt-Tab (mit Liste, Monat, Filter)
export default function SettingsBackLink() {
	const router = useRouter()
	return (
		<Link
			href="/shop"
			className="btn-link text-sm"
			onClick={(event) => {
				event.preventDefault()
				router.push(mainTabUrl())
			}}
		>
			← Zurück
		</Link>
	)
}
