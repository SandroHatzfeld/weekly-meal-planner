// Allgemeine UI-Icons (Formen aus Lucide, ISC-Lizenz)
const ICONS = {
	calendarPlus: ["M8 2v4", "M16 2v4", "M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8", "M3 10h18", "M16 19h6", "M19 16v6"],
	eye: ["M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0", "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
	eyeOff: [
		"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
		"M14.084 14.158a3 3 0 0 1-4.242-4.242",
		"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
		"m2 2 20 20",
	],
	pencil: ["M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z", "m15 5 4 4"],
	trash: ["M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", "M10 11v6", "M14 11v6"],
} as const

export type IconName = keyof typeof ICONS

export default function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
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
			aria-hidden="true"
		>
			{ICONS[name].map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	)
}

// quadratischer Icon-Button mit zugänglichem Namen
export const iconButtonClass =
	"flex size-10 shrink-0 items-center justify-center rounded-full border border-(--border) bg-(--surface) text-(--foreground) hover:no-underline disabled:opacity-50"
