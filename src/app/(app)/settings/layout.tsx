import TabCarousel from "@/components/main/TabCarousel"
import { SETTINGS_TABS } from "@/lib/tabs"

// Einstellungen als eigene Tab-Gruppe (Plan, Konto): gleiche Mechanik wie die Haupt-Tabs (Parallel Routes, Karussell)
export default function SettingsLayout({ children, plan, account }: LayoutProps<"/settings"> & { plan: React.ReactNode; account: React.ReactNode }) {
	return (
		<>
			{children}
			<TabCarousel tabs={SETTINGS_TABS} panels={[plan, account]} />
		</>
	)
}
