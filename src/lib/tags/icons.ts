// Feste Icon-Auswahl für Plan-Tags (Formen aus Lucide, ISC-Lizenz). Gespeichert wird nur der Schlüssel.

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

export const TAG_ICONS = {
	flame: {
		label: "Flamme",
		paths: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
	},
	percent: { label: "Prozent", paths: ["M19 5 5 19", circle(6.5, 6.5, 2.5), circle(17.5, 17.5, 2.5)] },
	smartphone: { label: "Handy", paths: ["M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M12 18h.01"] },
	tag: {
		label: "Etikett",
		paths: ["M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z", "M7.5 7.5h.01"],
	},
	star: { label: "Stern", paths: ["M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"] },
	snowflake: { label: "Tiefkühl", paths: ["M2 12h20", "M12 2v20", "m20 16-4-4 4-4", "m4 8 4 4-4 4", "m16 4-4 4-4-4", "m8 20 4-4 4 4"] },
	leaf: { label: "Bio", paths: ["M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z", "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"] },
	heart: {
		label: "Herz",
		paths: ["M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"],
	},
	alert: { label: "Wichtig", paths: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"] },
	clock: { label: "Uhr", paths: [circle(12, 12, 10), "M12 6v6l4 2"] },
	gift: {
		label: "Geschenk",
		paths: ["M20 12v10H4V12", "M2 7h20v5H2z", "M12 22V7", "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z", "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"],
	},
	cart: { label: "Einkaufswagen", paths: ["M2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6", circle(9, 21, 1), circle(20, 21, 1)] },
} as const

export type TagIconKey = keyof typeof TAG_ICONS

export const isTagIcon = (value: string): value is TagIconKey => Object.hasOwn(TAG_ICONS, value)

// werden für jeden neuen Plan angelegt (bestehende Pläne: Migration plan_tags)
export const DEFAULT_TAGS: { name: string; icon: TagIconKey }[] = [
	{ name: "Aktion", icon: "flame" },
	{ name: "Angebot", icon: "percent" },
	{ name: "App", icon: "smartphone" },
]

export type TagDTO = { id: string; name: string; icon: TagIconKey }

export const toTagDTO = (tag: { id: string; name: string; icon: string }): TagDTO => ({
	id: tag.id,
	name: tag.name,
	icon: isTagIcon(tag.icon) ? tag.icon : "tag",
})
