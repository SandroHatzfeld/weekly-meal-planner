import { GenericInvite, InviteForm, LeavePlanButton, PlanNameForm, RemoveMemberButton, RevokeInviteButton } from "@/components/settings/SettingsControls"
import CategoryManager from "@/components/settings/CategoryManager"
import ListSettings from "@/components/settings/ListSettings"
import ProductCsv from "@/components/settings/ProductCsv"
import ProductMemorySettings from "@/components/settings/ProductMemorySettings"
import SettingsSection from "@/components/settings/SettingsSection"
import Link from "next/link"
import SettingsBackLink from "@/components/settings/SettingsBackLink"
import TagSettings from "@/components/tags/TagSettings"
import { listsWithDefault } from "@/lib/grocery/queries"
import { categoriesOfPlan, categoryOrderOfPlan, hiddenCategoriesOfPlan, productMemoryOfPlan } from "@/lib/grocery/categories"
import { appUrl } from "@/lib/mail"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"
import { tagsOfPlan } from "@/lib/tags/queries"

const formatDate = (date: Date) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)

// Einstellungen des aktiven Plans; jeder Abschnitt ist aufklappbar
export default async function PlanSettingsPage({ searchParams }: { searchParams?: Promise<{ inviteFailed?: string }> }) {
	// nach dem Anlegen eines Plans: Einladungen, deren E-Mail nicht verschickt werden konnte
	const inviteFailed = (await searchParams)?.inviteFailed?.split(",").filter(Boolean) ?? []
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
	const [categories, categoryOrder, hiddenCategories, products] = await Promise.all([
		categoriesOfPlan(planId),
		categoryOrderOfPlan(planId),
		hiddenCategoriesOfPlan(planId),
		productMemoryOfPlan(planId),
	])

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<SettingsBackLink />
				<Link href="/onboarding" className="btn-link text-sm">
					+ Neuer Plan
				</Link>
			</div>
			{inviteFailed.length > 0 && (
				<p className="notice text-sm" role="status">
					Der Plan ist angelegt, aber die Einladung an {inviteFailed.join(", ")} konnte nicht verschickt werden. Unter „Einladungen“ kannst du es erneut versuchen.
				</p>
			)}

			<SettingsSection title="Plandetails">
				{isOwner ? (
					<PlanNameForm planId={plan.id} name={plan.name} />
				) : (
					<p>
						<span className="block text-sm font-medium">Name</span>
						{plan.name}
					</p>
				)}
			</SettingsSection>

			<SettingsSection title={`Mitglieder (${plan.members.length})`}>
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
			</SettingsSection>

			{/* Einladungen verwaltet nur der Owner */}
			{isOwner && (
				<SettingsSection title="Einladungen">
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
				</SettingsSection>
			)}

			<SettingsSection
				title="Einkaufslisten"
				description="Zutaten landen beim Planen auf der Standardliste (Stern), solange du im Popup keine andere wählst. Am Griff links ziehst du die Listen in die Reihenfolge der Reiter."
			>
				<ListSettings planId={plan.id} lists={lists} defaultListId={defaultListId} categories={categories} categoryOrder={categoryOrder} hiddenCategories={hiddenCategories} />
			</SettingsSection>

			<SettingsSection
				title="Kategorien"
				description="Gelten für alle Listen dieses Plans. Die Reihenfolge im Laden stellst du pro Liste unter „Einkaufslisten“ ein."
			>
				<CategoryManager planId={plan.id} categories={categories} />
			</SettingsSection>

			<SettingsSection
				title={`Produkte (${products.length})`}
				description="Bekannte Produkte landen beim Eintragen automatisch in ihrer Kategorie und erscheinen als Vorschläge."
			>
				<ProductCsv planId={plan.id} categories={categories} products={products} />
				<ProductMemorySettings planId={plan.id} categories={categories} products={products} />
			</SettingsSection>

			<SettingsSection
				title="Tags für die Einkaufsliste"
				description="Gelten für alle Mitglieder dieses Plans. Vergeben werden sie in der Einkaufsliste per Gedrückthalten auf einen Eintrag."
			>
				<TagSettings planId={plan.id} tags={tags} />
			</SettingsSection>
		</div>
	)
}
