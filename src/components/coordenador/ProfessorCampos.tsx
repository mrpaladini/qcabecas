"use client"

import { DIAS_SEMANA, SERIES_OPCOES, type DiaKey, type Disponibilidade, type SerieKey } from "@/lib/professor"

export type ProfessorExtras = {
  seriesAtendidas: SerieKey[]
  atendePresencial: boolean
  atendeOnline: boolean
  disponibilidade: Disponibilidade[]
}

export const PROFESSOR_EXTRAS_VAZIO: ProfessorExtras = {
  seriesAtendidas: [],
  atendePresencial: false,
  atendeOnline: false,
  disponibilidade: [],
}

/** Escreve os campos no FormData no formato esperado pelas server actions. */
export function appendProfessorExtras(fd: FormData, v: ProfessorExtras) {
  fd.set("seriesAtendidas", JSON.stringify(v.seriesAtendidas))
  fd.set("disponibilidade", JSON.stringify(v.disponibilidade.filter(h => h.inicio && h.fim && h.inicio < h.fim)))
  fd.set("atendePresencial", v.atendePresencial ? "true" : "false")
  fd.set("atendeOnline", v.atendeOnline ? "true" : "false")
}

const CHIP_ON  = "bg-primary-600 text-white border-primary-600"
const CHIP_OFF = "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"

function DisponibilidadeEditor({ value, onChange }: { value: Disponibilidade[]; onChange: (v: Disponibilidade[]) => void }) {
  function add(dia: DiaKey) {
    const doDia = value.filter(h => h.dia === dia)
    const ultimo = doDia[doDia.length - 1]
    // Sugere a próxima faixa logo depois da última do dia
    const sugestao = ultimo ? { inicio: ultimo.fim, fim: ultimo.fim < "22:00" ? addHoras(ultimo.fim, 2) : "23:00" } : { inicio: "14:00", fim: "18:00" }
    onChange([...value, { dia, ...sugestao }])
  }
  function update(idx: number, campo: "inicio" | "fim", v: string) {
    onChange(value.map((h, i) => (i === idx ? { ...h, [campo]: v } : h)))
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
      {DIAS_SEMANA.map(d => {
        const faixas = value.map((h, idx) => ({ h, idx })).filter(x => x.h.dia === d.key)
        return (
          <div key={d.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="w-20 text-sm font-medium text-neutral-700 shrink-0">{d.label}</span>
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {faixas.length === 0 && <span className="text-xs text-neutral-400 italic">Indisponível</span>}
              {faixas.map(({ h, idx }) => {
                const invalido = !!h.inicio && !!h.fim && h.inicio >= h.fim
                return (
                  <span key={idx} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${invalido ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"}`}>
                    <input type="time" value={h.inicio} onChange={e => update(idx, "inicio", e.target.value)}
                      aria-label={`${d.label} início`}
                      className="bg-transparent text-sm focus:outline-none" />
                    <span className="text-xs text-neutral-400">às</span>
                    <input type="time" value={h.fim} onChange={e => update(idx, "fim", e.target.value)}
                      aria-label={`${d.label} fim`}
                      className="bg-transparent text-sm focus:outline-none" />
                    <button type="button" onClick={() => remove(idx)} title="Remover horário"
                      className="text-neutral-400 hover:text-red-600 text-sm px-1">✕</button>
                  </span>
                )
              })}
            </div>
            <button type="button" onClick={() => add(d.key)}
              className="text-xs font-semibold text-primary-600 border border-primary-200 rounded-lg px-2.5 py-1 hover:bg-primary-50 shrink-0">
              + horário
            </button>
          </div>
        )
      })}
    </div>
  )
}

function addHoras(hhmm: string, horas: number) {
  const [h, m] = hhmm.split(":").map(Number)
  const t = Math.min(h + horas, 23)
  return `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function ProfessorCampos({ value, onChange, compact }: {
  value: ProfessorExtras
  onChange: (v: ProfessorExtras) => void
  compact?: boolean
}) {
  const labelCls = compact
    ? "block text-xs font-medium text-neutral-600 mb-1.5"
    : "block text-sm font-medium text-neutral-700 mb-1.5"

  function toggleSerie(k: SerieKey) {
    const tem = value.seriesAtendidas.includes(k)
    onChange({ ...value, seriesAtendidas: tem ? value.seriesAtendidas.filter(s => s !== k) : [...value.seriesAtendidas, k] })
  }

  return (
    <div className="space-y-4">
      <div>
        <span className={labelCls}>Séries que atende</span>
        <div className="flex flex-wrap gap-2">
          {SERIES_OPCOES.map(s => {
            const on = value.seriesAtendidas.includes(s.key)
            return (
              <button key={s.key} type="button" onClick={() => toggleSerie(s.key)} aria-pressed={on}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${on ? CHIP_ON : CHIP_OFF}`}>
                {on ? "✓ " : ""}{s.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <span className={labelCls}>Atende</span>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input type="checkbox" checked={value.atendePresencial}
              onChange={e => onChange({ ...value, atendePresencial: e.target.checked })}
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
            🏫 Presencial
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input type="checkbox" checked={value.atendeOnline}
              onChange={e => onChange({ ...value, atendeOnline: e.target.checked })}
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
            💻 Online
          </label>
        </div>
      </div>

      <div>
        <span className={labelCls}>Disponibilidade semanal</span>
        <p className="text-xs text-neutral-400 mb-2">Usada no agendamento para indicar se o professor está disponível no horário pedido.</p>
        <DisponibilidadeEditor value={value.disponibilidade} onChange={disponibilidade => onChange({ ...value, disponibilidade })} />
      </div>
    </div>
  )
}
