import Icon from "@/components/ui/Icon"
import type { ReactNode } from "react"

// aufklappbarer Abschnitt der Einstellungen, standardmäßig eingeklappt
export default function SettingsSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
	return (
		<section className="card">
			<details className="group/section">
				<summary className="-m-2 flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded p-2 [&::-webkit-details-marker]:hidden">
					<h2 className="text-lg font-semibold">{title}</h2>
					<Icon name="chevronDown" className="size-5 shrink-0 opacity-70 transition-transform group-open/section:rotate-180" />
				</summary>
				<div className="mt-3 space-y-3">
					{description && <p className="text-sm opacity-70">{description}</p>}
					{children}
				</div>
			</details>
		</section>
	)
}
