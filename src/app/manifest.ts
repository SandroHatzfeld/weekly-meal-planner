import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Weekly Meal Planner",
		short_name: "Mealplanner",
		description: "Gerichte planen und Einkaufen",
		lang: "de",
		start_url: "/week",
		scope: "/",
		display: "standalone",
		background_color: "#0a0a0a",
		theme_color: "#047857",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	}
}
