import { ApiTokens, GenericInvite, InviteForm, LeavePlanButton, PlanNameForm, RemoveMemberButton, RevokeInviteButton } from "@/components/settings/SettingsControls"
import CategoryManager from "@/components/settings/CategoryManager"
import ListSettings from "@/components/settings/ListSettings"
import ProductMemorySettings from "@/components/settings/ProductMemorySettings"
import TagSettings from "@/components/tags/TagSettings"
import { signOut } from "@/lib/auth/auth"
import { listsWithDefault } from "@/lib/grocery/queries"
import { categoriesOfPlan, categoryOrderOfPlan, productMemoryOfPlan } from "@/lib/grocery/categories"
import { appUrl } from "@/lib/mail"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"
import { tagsOfPlan } from "@/lib/tags/queries"

const formatDate = (date: Date) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)

export default async function SettingsPage() {
	const { user, planId } = await requireActivePlan()

	const plan = await prisma.plan.findUniqueOrThrow({
		where: { id: planId },
		include: {
			members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { joinedAt: "asc" } },
			invites: { where: { status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } },
		},
	})
	const isOwner = plan.members.some((member) => member.userId === user.id && member.role === "OWNER")
	const genericInvite = plan.invites.find((invite) => invite.type === "GENERIC")
	const personalInvites = plan.invites.filter((invite) => invite.type === "PERSONAL")
	const tags = await tagsOfPlan(planId)
	const { lists, defaultListId } = await listsWithDefault(planId)
	const [categories, categoryOrder, products] = await Promise.all([categoriesOfPlan(planId), categoryOrderOfPlan(planId), productMemoryOfPlan(planId)])
	const apiTokens = await prisma.apiToken.findMany({
		where: { userId: user.id },
		select: { id: true, name: true, createdAt: true, lastUsedAt: true },
		orderBy: { createdAt: "desc" },
	})

	return (
		<div className="space-y-6">
			<section className="card space-y-2">
				<h2 className="text-lg font-semibold">Plan</h2>
				{isOwner ? <PlanNameForm planId={plan.id} name={plan.name} /> : <p>{plan.name}</p>}
			</section>

			<section className="card space-y-2">
				<h2 className="text-lg font-semibold">Mitglieder</h2>
				<ul className="divide-y divide-black/5 dark:divide-white/10">
					{plan.members.map((member) => (
						<li key={member.userId} className="flex items-center gap-2 py-2">
							<span className="flex-1">
								{member.user.name} <span className="text-sm opacity-60">{member.user.email}</span>
							</span>
							{member.role === "OWNER" && <span className="badge">Owner</span>}
							{member.userId === user.id && <span className="badge">Du</span>}
							{isOwner && member.userId !== user.id && <RemoveMemberButton planId={plan.id} userId={member.userId} name={member.user.name} />}
						</li>
					))}
				</ul>
				<LeavePlanButton planId={plan.id} isLastMember={plan.members.length === 1} />
			</section>

			{/* Einladungen verwaltet nur der Owner */}
			{isOwner && (
				<section className="card space-y-3">
					<h2 className="text-lg font-semibold">Einladungen</h2>
					<InviteForm planId={plan.id} />
					{personalInvites.length > 0 && (
						<ul className="text-sm">
							{personalInvites.map((invite) => (
								<li key={invite.id} className="flex items-center gap-2">
									<span className="flex-1">
										{invite.email} <span className="opacity-60">(gültig bis {formatDate(invite.expiresAt)})</span>
									</span>
									<RevokeInviteButton planId={plan.id} inviteId={invite.id} />
								</li>
							))}
						</ul>
					)}
					<GenericInvite
						planId={plan.id}
						link={genericInvite ? appUrl(`/invite/${genericInvite.token}`) : null}
						expiresAt={genericInvite ? formatDate(genericInvite.expiresAt) : null}
					/>
				</section>
			)}

			<section className="card space-y-3">
				<h2 className="text-lg font-semibold">Einkaufslisten</h2>
				<p className="text-sm opacity-70">
					Zutaten landen beim Planen auf der Standardliste, solange du im Popup keine andere wählst.
				</p>
				<ListSettings planId={plan.id} lists={lists} defaultListId={defaultListId} categories={categories} categoryOrder={categoryOrder} />
			</section>

			<section className="card space-y-3">
				<h2 className="text-lg font-semibold">Kategorien & Produkte</h2>
				<p className="text-sm opacity-70">
					Gelten für alle Listen dieses Plans. Bekannte Produkte landen beim Eintragen automatisch in ihrer Kategorie, die Reihenfolge im Laden stellst du pro Liste ein.
				</p>
				<CategoryManager planId={plan.id} categories={categories} />
				<details className="group">
					<summary className="btn-link cursor-pointer text-sm">Bekannte Produkte ({products.length})</summary>
					<div className="mt-2">
						<ProductMemorySettings planId={plan.id} categories={categories} products={products} />
					</div>
				</details>
			</section>

			<section className="card space-y-3">
				<h2 className="text-lg font-semibold">Tags für die Einkaufsliste</h2>
				<p className="text-sm opacity-70">Gelten für alle Mitglieder dieses Plans. Vergeben werden sie in der Einkaufsliste per Gedrückthalten auf einen Eintrag.</p>
				<TagSettings planId={plan.id} tags={tags} />
			</section>

			<section className="card space-y-3">
				<h2 className="text-lg font-semibold">API-Tokens</h2>
				<p className="text-sm opacity-70">
					Für Home Assistant, Shortcuts & Co. Ein Token gewährt Zugriff auf die Einkaufslisten aller deiner Pläne (
					<code>Authorization: Bearer …</code> an <code>/api/external/…</code>).
				</p>
				<ApiTokens
					tokens={apiTokens.map((token) => ({
						id: token.id,
						name: token.name,
						createdAt: formatDate(token.createdAt),
						lastUsedAt: token.lastUsedAt ? formatDate(token.lastUsedAt) : null,
					}))}
				/>
			</section>

			<form
				action={async () => {
					"use server"
					await signOut({ redirectTo: "/login" })
				}}
			>
				<button type="submit" className="btn-secondary">
					Abmelden
				</button>
			</form>
		</div>
	)
}
