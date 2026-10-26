import TabCarousel from "@/components/main/TabCarousel"

// Alle vier Haupt-Tabs werden gleichzeitig gerendert (Parallel Routes) und liegen nebeneinander im Karussell.
// Wischen oder ein Tab-Klick verschiebt nur den Streifen; die Adresse wird ohne Server-Anfrage angepasst.
export default function TabsLayout({ shop, week, month, recipes }: LayoutProps<"/"> & { shop: React.ReactNode; week: React.ReactNode; month: React.ReactNode; recipes: React.ReactNode }) {
	return <TabCarousel panels={[shop, week, month, recipes]} />
}
