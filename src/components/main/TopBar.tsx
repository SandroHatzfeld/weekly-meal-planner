import TabBar from "./TabBar"

export default function TopBar({ currentPlan }: { currentPlan: string }) {
	const topBarTabs: Tabs[] = [
		{tabName: "Woche", tabTarget: "week"},
		{tabName: "Monat", tabTarget: "month"},
		{tabName: "Einkaufen", tabTarget: "shop"},
		{tabName: "Planen", tabTarget: "plan"},
		
	]

	return (
		<header>
			<div>
				<h1>Mealplanner | {currentPlan}</h1>
			</div>
			<TabBar tabs={topBarTabs}/>
		</header>
	)
}
