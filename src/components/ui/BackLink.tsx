"use client"

import { canGoBackInApp } from "@/lib/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"

// „Zurück“ dorthin, woher man in der App kam; ohne Verlauf (direkter Aufruf) zum festen Ziel
export default function BackLink({ fallback, className = "btn-link text-sm" }: { fallback: string; className?: string }) {
	const router = useRouter()
	return (
		<Link
			href={fallback}
			className={className}
			onClick={(event) => {
				if (!canGoBackInApp()) return
				event.preventDefault()
				router.back()
			}}
		>
			← Zurück
		</Link>
	)
}
