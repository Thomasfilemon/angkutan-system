import React, { useMemo } from "react";

type Props = {
	value: string | number;
	onChange: (numericString: string) => void;
	placeholder?: string;
	className?: string;
	showPrefix?: boolean;
	disabled?: boolean;
	name?: string;
	id?: string;
};

// Format "10000" -> "10.000"
function formatThousands(idrNumericString: string): string {
	const raw = String(idrNumericString || "").replace(/[^0-9]/g, "");
	if (raw.length === 0) return "";
	// Remove leading zeros but preserve "0"
	const cleaned = raw.replace(/^0+(?=\d)/, "");
	return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function CurrencyInput({
	value,
	onChange,
	placeholder,
	className,
	showPrefix = true,
	disabled,
	name,
	id,
}: Props) {
	const numericString = useMemo(() => {
		const v = typeof value === "number" ? Math.floor(value).toString() : (value || "").toString();
		return v.replace(/[^0-9]/g, "");
	}, [value]);

	const display = useMemo(() => {
		const formatted = formatThousands(numericString);
		return showPrefix && formatted ? `Rp ${formatted}` : formatted;
	}, [numericString, showPrefix]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const input = e.target.value || "";
		// Strip any non-digits
		const onlyDigits = input.replace(/[^0-9]/g, "");
		onChange(onlyDigits);
	};

	return (
		<input
			type="text"
			name={name}
			id={id}
			value={display}
			onChange={handleChange}
			placeholder={placeholder || (showPrefix ? "Rp 0" : "0")}
			className={className}
			disabled={disabled}
			inputMode="numeric"
			autoComplete="off"
		/>
	);
}


