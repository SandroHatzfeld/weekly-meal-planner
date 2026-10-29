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
	buttonClassName = "min-h-10",
	placeholder,
	align = "right",
}: {
	label: string
	value: T | ""
	options: Option<T>[]
	onChange: (value: T) => void
	className?: string
	// Größe des Auslösers (Standard: 40 px hoch)
	buttonClassName?: string
	// Text ohne Auswahl, z.B. „+ Kategorie“ (Auswahl wirkt dann wie eine Aktion)
	placeholder?: string
	// Kante, an der das Menü ausgerichtet wird
	align?: "left" | "right"
}) {
	const [open, setOpen] = useState(false)
	const [active, setActive] = useState(0)
	const root = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	const listId = useId()
	const current = options.find((option) => option.value === value) ?? (placeholder === undefined ? options[0] : undefined)
	const list = useRef<HTMLUListElement>(null)

	// lange Listen: aktive Option (Tastatur) sichtbar halten; von Hand, scrollIntoView würde auch das Tab-Karussell verschieben
	useEffect(() => {
		const menu = list.current
		const item = menu?.children[active] as HTMLElement | undefined
		if (!menu || !item) return
		if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop
		else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight
	}, [active, open])

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
		setActive(current ? Math.max(0, options.indexOf(current)) : 0)
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
				aria-label={current ? `${label}: ${current.label}` : label}
				className={`input flex h-full w-full items-center justify-between gap-2 text-left ${buttonClassName}`}
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
				<span className="truncate">{current?.label ?? placeholder}</span>
				<svg viewBox="0 0 24 24" className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
			{open && (
				<ul
					ref={list}
					id={listId}
					role="listbox"
					aria-label={label}
					className={`absolute top-full z-20 mt-1 max-h-72 min-w-full overflow-y-auto rounded border border-(--border) bg-(--surface) shadow-lg ${align === "left" ? "left-0" : "right-0"}`}
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
