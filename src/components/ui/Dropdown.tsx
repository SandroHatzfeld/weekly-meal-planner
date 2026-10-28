"use client"

import { useEffect, useId, useRef, useState } from "react"

type Option<T extends string> = { value: T; label: string }

// Auswahl, die direkt unter dem Feld aufklappt (statt des System-Auswahlfensters auf dem Handy).
// Bedienbar mit Maus, Touch und Tastatur (↑/↓, Enter, Escape).
export default function Dropdown<T extends string>({
	label,
	value,
	options,
	onChange,
	className = "",
}: {
	label: string
	value: T
	options: Option<T>[]
	onChange: (value: T) => void
	className?: string
}) {
	const [open, setOpen] = useState(false)
	const [active, setActive] = useState(0)
	const root = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	const listId = useId()
	const current = options.find((option) => option.value === value) ?? options[0]

	// Außenklick und Escape schließen
	useEffect(() => {
		if (!open) return
		const onPointerDown = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener("pointerdown", onPointerDown)
		return () => document.removeEventListener("pointerdown", onPointerDown)
	}, [open])

	const choose = (option: Option<T>) => {
		onChange(option.value)
		setOpen(false)
		button.current?.focus()
	}

	const openMenu = () => {
		setActive(Math.max(0, options.indexOf(current)))
		setOpen(true)
	}

	return (
		<div ref={root} className={`relative ${className}`}>
			<button
				ref={button}
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listId}
				aria-label={`${label}: ${current.label}`}
				className="input flex h-full min-h-10 w-full items-center justify-between gap-2 text-left"
				onClick={() => (open ? setOpen(false) : openMenu())}
				onKeyDown={(event) => {
					if (event.key === "Escape" && open) {
						event.preventDefault()
						event.stopPropagation()
						setOpen(false)
					} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault()
						if (!open) return openMenu()
						setActive((index) => (index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length)
					} else if ((event.key === "Enter" || event.key === " ") && open) {
						event.preventDefault()
						choose(options[active])
					}
				}}
			>
				<span className="truncate">{current.label}</span>
				<svg viewBox="0 0 24 24" className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
			{open && (
				<ul
					id={listId}
					role="listbox"
					aria-label={label}
					className="absolute top-full right-0 z-20 mt-1 min-w-full overflow-hidden rounded border border-(--border) bg-(--surface) shadow-lg"
				>
					{options.map((option, index) => {
						const selected = option.value === value
						return (
							<li
								key={option.value}
								role="option"
								aria-selected={selected}
								className={`flex min-h-10 cursor-pointer items-center gap-2 px-3 whitespace-nowrap ${index === active ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
								onPointerEnter={() => setActive(index)}
								// mousedown statt click: der Button behält den Fokus
								onMouseDown={(event) => {
									event.preventDefault()
									choose(option)
								}}
							>
								<span className="w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true">
									{selected ? "✓" : ""}
								</span>
								{option.label}
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
