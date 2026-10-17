"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

export type BuscaOpcao = {
  id: string
  label: string
  sublabel?: string
  /** Selo à direita da opção (ex.: "✓ Disponível") */
  badge?: { text: string; tone: "green" | "amber" | "red" | "neutral" }
}

const TONE: Record<string, string> = {
  green:   "bg-green-100 text-green-700",
  amber:   "bg-amber-100 text-amber-700",
  red:     "bg-red-100 text-red-700",
  neutral: "bg-neutral-100 text-neutral-500",
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/**
 * Campo com busca e sugestões automáticas (autocomplete).
 * Envia o id escolhido num <input type="hidden" name={name}>.
 */
export function BuscaSelect({
  name, opcoes, value, onChange, placeholder, disabled, hasError, id, vazioTexto = "Nenhum resultado",
}: {
  name: string
  opcoes: BuscaOpcao[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  hasError?: boolean
  id?: string
  vazioTexto?: string
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-lista`
  const selecionada = opcoes.find(o => o.id === value) ?? null

  const [texto, setTexto] = useState(selecionada?.label ?? "")
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Mantém o texto sincronizado quando o valor muda por fora (reset, troca de disciplina…)
  useEffect(() => {
    if (!aberto) setTexto(selecionada?.label ?? "")
  }, [selecionada?.label, aberto])

  const filtradas = useMemo(() => {
    const termos = normalizar(texto).split(/\s+/).filter(Boolean)
    // Com uma opção já escolhida e o texto igual ao nome dela, mostra a lista toda
    if (!termos.length || (selecionada && texto === selecionada.label)) return opcoes
    return opcoes.filter(o => {
      const alvo = normalizar(`${o.label} ${o.sublabel ?? ""}`)
      return termos.every(t => alvo.includes(t))
    })
  }, [opcoes, texto, selecionada])

  useEffect(() => { setAtivo(0) }, [texto])

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) fechar()
    }
    document.addEventListener("mousedown", fora)
    return () => document.removeEventListener("mousedown", fora)
  })

  useEffect(() => {
    const el = listRef.current?.children[ativo] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [ativo])

  function escolher(o: BuscaOpcao) {
    onChange(o.id)
    setTexto(o.label)
    setAberto(false)
  }

  function fechar() {
    setAberto(false)
    // Texto digitado que não corresponde a ninguém volta para a opção selecionada
    setTexto(selecionada?.label ?? "")
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setAtivo(i => Math.min(i + 1, filtradas.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo(i => Math.max(i - 1, 0)) }
    else if (e.key === "Enter") {
      if (aberto && filtradas[ativo]) { e.preventDefault(); escolher(filtradas[ativo]) }
    }
    else if (e.key === "Escape") { fechar() }
    else if (e.key === "Tab") { if (aberto && filtradas.length === 1) escolher(filtradas[0]); else fechar() }
  }

  const base = "w-full rounded-xl px-3 py-2.5 pr-8 text-sm bg-white focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
  const borda = hasError
    ? "border border-red-400 ring-2 ring-red-200 focus:ring-red-400"
    : "border border-neutral-300 focus:ring-2 focus:ring-primary-500"

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={texto}
        placeholder={placeholder}
        onChange={e => {
          setTexto(e.target.value)
          setAberto(true)
          if (!e.target.value) onChange("")
        }}
        onFocus={e => { setAberto(true); e.currentTarget.select() }}
        onKeyDown={onKeyDown}
        className={`${base} ${borda}`}
      />
      {value && !disabled ? (
        <button type="button" tabIndex={-1} aria-label="Limpar"
          onClick={() => { onChange(""); setTexto(""); setAberto(true) }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-sm">✕</button>
      ) : (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs pointer-events-none">▼</span>
      )}

      {aberto && !disabled && (
        <ul id={listId} ref={listRef} role="listbox"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-auto bg-white border border-neutral-200 rounded-xl shadow-lg py-1">
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-400">{vazioTexto}</li>
          ) : filtradas.map((o, i) => (
            <li key={o.id} role="option" aria-selected={o.id === value}
              onMouseDown={e => { e.preventDefault(); escolher(o) }}
              onMouseEnter={() => setAtivo(i)}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${i === ativo ? "bg-primary-50" : ""} ${o.id === value ? "font-semibold" : ""}`}>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-neutral-900 truncate">{o.label}</span>
                {o.sublabel && <span className="block text-xs text-neutral-400 truncate">{o.sublabel}</span>}
              </span>
              {o.badge && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TONE[o.badge.tone]}`}>{o.badge.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
