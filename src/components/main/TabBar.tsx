import Link from "next/link"


export default function TabBar({tabs}: {tabs:Tabs[]}) {
	return (
		<div>
			{tabs.map((tab, index) => {
				return (
					<Link key={index} href={tab.tabTarget}>
						{tab.tabName}
					</Link>
				)
			})}
		</div>
	)
}
