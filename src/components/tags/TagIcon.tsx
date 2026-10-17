import { TAG_ICONS, type TagIconKey } from "@/lib/tags/icons"

export default function TagIcon({ icon, className = "size-4", title }: { icon: TagIconKey; className?: string; title?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			role={title ? "img" : undefined}
			aria-hidden={title ? undefined : true}
		>
			{title && <title>{title}</title>}
			{TAG_ICONS[icon].paths.map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	)
}
