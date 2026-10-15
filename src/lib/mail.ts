// E-Mail-Versand über die Resend REST-API. Ohne RESEND_API_KEY wird nur geloggt (lokale Entwicklung).

export const appUrl = (path: string) => `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`

export const sendMail = async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
	const apiKey = process.env.RESEND_API_KEY
	if (!apiKey || apiKey === "XXXX") {
		console.log(`[mail] (kein RESEND_API_KEY) an ${to}: ${subject}\n${html}`)
		return
	}

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
		body: JSON.stringify({
			from: process.env.MAIL_FROM ?? "Weekly Meal Planner <noreply@example.com>",
			to,
			subject,
			html,
		}),
	})
	if (!response.ok) {
		console.error("[mail] Versand fehlgeschlagen", response.status, await response.text())
		throw new Error("E-Mail konnte nicht versendet werden")
	}
}

export const escapeHtml = (value: string) =>
	value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
