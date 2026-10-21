// Allgemeine UI-Icons (Formen aus Lucide, ISC-Lizenz)
const ICONS = {
	clock: ["M12 6v6l4 2", "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0"],
	calendarPlus: ["M8 2v4", "M16 2v4", "M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8", "M3 10h18", "M16 19h6", "M19 16v6"],
	download: ["M12 15V3", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5"],
	externalLink: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
	refresh: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
	plus: ["M5 12h14", "M12 5v14"],
	eye: ["M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0", "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
	eyeOff: [
		"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
		"M14.084 14.158a3 3 0 0 1-4.242-4.242",
		"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
		"m2 2 20 20",
	],
	grip: ["M8 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M8 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M8 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M14 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M14 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M14 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0"],
	pencil: ["M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z", "m15 5 4 4"],
	star: [
		"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
	],
	trash: ["M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", "M10 11v6", "M14 11v6"],
} as const

export type IconName = keyof typeof ICONS

// filled: Fläche in Linienfarbe füllen (z.B. gefüllter Stern = aktiv)
export default function Icon({ name, className = "size-5", filled = false }: { name: IconName; className?: string; filled?: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill={filled ? "currentColor" : "none"}
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
// Griff zum Ziehen: wie ein Icon-Button, aber ohne Scrollen bei Touch
export const handleButtonClass = "touch-none cursor-grab select-none [-webkit-touch-callout:none] active:cursor-grabbing"

export const iconButtonClass =
	"flex size-10 shrink-0 items-center justify-center rounded-full border border-(--border) bg-(--surface) text-(--foreground) hover:no-underline disabled:opacity-50"
