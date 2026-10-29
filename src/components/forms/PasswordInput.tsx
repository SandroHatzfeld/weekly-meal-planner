"use client"

import Icon from "@/components/ui/Icon"
import { useState, type InputHTMLAttributes } from "react"

// Passwortfeld mit Auge zum Anzeigen des Textes
export default function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
	const [visible, setVisible] = useState(false)
	return (
		<div className="relative">
			<input {...props} type={visible ? "text" : "password"} className={`${className} pr-11!`} />
			<button
				type="button"
				className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center opacity-70 hover:opacity-100"
				aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
				aria-pressed={visible}
				aria-controls={props.id}
				onClick={() => setVisible(!visible)}
			>
				<Icon name={visible ? "eyeOff" : "eye"} className="size-5" />
			</button>
		</div>
	)
}
