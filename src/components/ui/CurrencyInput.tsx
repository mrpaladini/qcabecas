"use client"

import { useState, useEffect } from "react"

function toNumeric(raw: string): string {
  // Remove tudo exceto dígitos e um separador decimal
  const cleaned = raw.replace(/[^\d,\.]/g, "")
  // Normaliza vírgula para ponto
  const normalized = cleaned.replace(",", ".")
  const num = parseFloat(normalized)
  if (isNaN(num) || num <= 0) return ""
  return num.toFixed(2)
}

function toDisplay(numericStr: string): string {
  if (!numericStr) return ""
  const num = parseFloat(numericStr)
  if (isNaN(num)) return ""
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toEditDisplay(numericStr: string): string {
  if (!numericStr) return ""
  const num = parseFloat(numericStr)
  if (isNaN(num)) return ""
  return String(num).replace(".", ",")
}

interface CurrencyInputProps {
  value: string              // numeric string, e.g. "150.00"
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  hasError?: boolean
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0,00",
  className = "",
  hasError = false,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(toDisplay(value))
  const [focused, setFocused] = useState(false)

  // Sync display when value changes externally (e.g. form reset)
  useEffect(() => {
    if (!focused) setDisplay(toDisplay(value))
  }, [value, focused])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End", ",", "."]
    const isDigit = /^\d$/.test(e.key)
    if (!isDigit && !allowed.includes(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
    }
    // Block second comma/period
    if ((e.key === "," || e.key === ".") && display.match(/[,\.]/)) {
      e.preventDefault()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Keep only digits and one separator
    let filtered = raw.replace(/[^\d,\.]/g, "")
    // At most one separator
    const parts = filtered.split(/[,\.]/)
    if (parts.length > 2) filtered = parts[0] + "," + parts.slice(1).join("")
    // Max 2 decimal places
    if (filtered.includes(",") || filtered.includes(".")) {
      const sep = filtered.includes(",") ? "," : "."
      const [int, dec] = filtered.split(sep)
      filtered = int + sep + (dec ?? "").slice(0, 2)
    }
    setDisplay(filtered)
  }

  function handleBlur() {
    setFocused(false)
    const numeric = toNumeric(display)
    onChange(numeric)
    setDisplay(numeric ? toDisplay(numeric) : "")
  }

  function handleFocus() {
    setFocused(true)
    setDisplay(value ? toEditDisplay(value) : "")
  }

  const borderClass = hasError
    ? "border-red-400 ring-2 ring-red-200 focus:ring-red-400"
    : "border-neutral-300 focus:ring-primary-500"

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 pointer-events-none select-none">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={`pl-9 ${borderClass} ${className} rounded-xl border px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2`}
      />
    </div>
  )
}
