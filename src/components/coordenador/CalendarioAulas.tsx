"use client"

import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar"
import { format, parse, startOfWeek, getDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useMemo } from "react"
import "react-big-calendar/lib/css/react-big-calendar.css"

const locales = { "pt-BR": ptBR }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
})

const messages = {
  allDay: "Dia inteiro",
  previous: "← Anterior",
  next: "Próximo →",
  today: "Hoje",
  month: "Mês",
  week: "Semana",
  day: "Dia",
  agenda: "Agenda",
  date: "Data",
  time: "Hora",
  event: "Aula",
  noEventsInRange: "Nenhuma aula neste período.",
}

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "#d97706",
  AGENDADO: "#2563eb",
  CANCELADO: "#dc2626",
  CONCLUIDO: "#16a34a",
}

type Sala = { id: number; name: string; type: string }
type Evento = {
  id: string
  title: string
  start: Date
  end: Date
  status: string
  aluno: string
  professor: string
  salaId: number | null
  sala: string | null
  salaTipo: string | null
}

// ─── Modal de detalhes ────────────────────────────────────────────────────────
function ModalEvento({ ev, onClose }: { ev: Evento; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-neutral-900 text-lg mb-3">{ev.title}</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-neutral-500">Aluno</dt><dd className="font-medium">{ev.aluno}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Professor</dt><dd className="font-medium">{ev.professor}</dd></div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Sala</dt>
            <dd className="font-medium">
              {ev.sala ? <span>{ev.salaTipo === "PRESENCIAL" ? "🏫" : "💻"} {ev.sala}</span>
                : <span className="text-neutral-400 italic">Não definida</span>}
            </dd>
          </div>
          <div className="flex justify-between"><dt className="text-neutral-500">Início</dt><dd className="font-medium">{ev.start.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Fim</dt><dd className="font-medium">{ev.end.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-500">Status</dt>
            <dd><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ev.status === "PENDENTE" ? "bg-amber-100 text-amber-700" : ev.status === "AGENDADO" ? "bg-blue-100 text-blue-700" : ev.status === "CONCLUIDO" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{ev.status}</span></dd>
          </div>
        </dl>
        <button onClick={onClose} className="mt-4 w-full bg-neutral-100 text-neutral-700 py-2 rounded-xl text-sm font-medium hover:bg-neutral-200 transition-colors">Fechar</button>
      </div>
    </div>
  )
}

// ─── Calendário padrão ────────────────────────────────────────────────────────
const MIN_TIME = new Date(0, 0, 0, 7, 0, 0)
const MAX_TIME = new Date(0, 0, 0, 22, 0, 0)

function CalendarioSingle({ eventos, titulo }: { eventos: Evento[]; titulo?: string }) {
  const [view, setView] = useState<any>(Views.WEEK)
  const [selected, setSelected] = useState<Evento | null>(null)

  // Em semana: 7 colunas × 180px = 1260px mínimo para que cada par de aulas simultâneas tenha espaço
  const minWidth = view === Views.WEEK ? "1260px" : view === Views.DAY ? "400px" : "100%"

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4">
      {titulo && <h3 className="font-semibold text-neutral-800 mb-3">{titulo}</h3>}

      {/* CSS injetado para garantir largura mínima nas colunas de dia */}
      <style>{`
        .rbc-time-header-cell { min-width: 160px; }
        .rbc-day-slot        { min-width: 160px; }
        .rbc-time-column     { min-width: 160px; }
        .rbc-day-bg          { min-width: 160px; }
        .rbc-event           { min-width: 70px; }
        .rbc-events-container { margin-right: 0 !important; }
      `}</style>

      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <Calendar
            localizer={localizer}
            events={eventos}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 620 }}
            culture="pt-BR"
            messages={messages}
            view={view}
            onView={setView}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            min={MIN_TIME}
            max={MAX_TIME}
            step={60}
            timeslots={1}
            eventPropGetter={(ev: any) => ({
              style: {
                backgroundColor: STATUS_COLORS[ev.status] ?? "#6b7280",
                borderRadius: "6px",
                border: "2px solid rgba(255,255,255,0.3)",
                color: "white",
                fontSize: "11px",
                padding: "3px 6px",
              },
            })}
            titleAccessor={(ev: any) => `${ev.aluno} · ${ev.professor}${ev.sala ? ` · ${ev.sala}` : ""}`}
            onSelectEvent={e => setSelected(e as Evento)}
            popup
          />
        </div>
      </div>

      {selected && <ModalEvento ev={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Grade por sala/horário ────────────────────────────────────────────────────
// Slots de 30 min de 07:00 a 21:30 → índices 0..29
const SLOT_INICIO_MIN = 7 * 60    // 07:00
const SLOT_FIM_MIN    = 22 * 60   // 22:00 (exclusive)
const SLOT_STEP       = 30
const SLOTS = Array.from(
  { length: (SLOT_FIM_MIN - SLOT_INICIO_MIN) / SLOT_STEP },
  (_, i) => SLOT_INICIO_MIN + i * SLOT_STEP,
) // [420, 450, 480, ... 1290]

function slotLabel(minutos: number) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function toSlotIndex(date: Date): number {
  return (date.getHours() * 60 + date.getMinutes() - SLOT_INICIO_MIN) / SLOT_STEP
}

type CelulaInfo =
  | { tipo: "evento"; ev: Evento; rowSpan: number }
  | { tipo: "ocupada" }
  | { tipo: "vazia" }

function buildGridColuna(eventosColuna: Evento[]): CelulaInfo[] {
  const grid: CelulaInfo[] = Array.from({ length: SLOTS.length }, () => ({ tipo: "vazia" }))

  for (const ev of eventosColuna) {
    const slotInicio = toSlotIndex(ev.start)
    const duracaoMin = (ev.end.getTime() - ev.start.getTime()) / 60000
    const rowSpan    = Math.max(1, Math.round(duracaoMin / SLOT_STEP))

    if (slotInicio < 0 || slotInicio >= SLOTS.length) continue

    grid[slotInicio] = { tipo: "evento", ev, rowSpan }
    for (let i = 1; i < rowSpan; i++) {
      if (slotInicio + i < SLOTS.length) grid[slotInicio + i] = { tipo: "ocupada" }
    }
  }

  return grid
}

function GradeSalaHorario({ eventos, salas, data }: { eventos: Evento[]; salas: Sala[]; data: Date }) {
  const [selected, setSelected] = useState<Evento | null>(null)

  const dia = new Date(data)
  dia.setHours(0, 0, 0, 0)
  const diaFim = new Date(dia)
  diaFim.setHours(23, 59, 59, 999)

  const eventosNoDia = eventos.filter(e => e.start >= dia && e.start <= diaFim)

  const salasComAulas = salas.filter(s => eventosNoDia.some(e => e.salaId === s.id))
  const semSalaHoje   = eventosNoDia.filter(e => e.salaId === null)

  if (salasComAulas.length === 0 && semSalaHoje.length === 0) return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500">
      Nenhuma aula agendada para este dia.
    </div>
  )

  const colunas: { id: number | "sem-sala"; label: string; tipo?: string }[] = [
    ...salasComAulas.map(s => ({ id: s.id as number | "sem-sala", label: s.name, tipo: s.type })),
    ...(semSalaHoje.length > 0 ? [{ id: "sem-sala" as const, label: "Sem sala", tipo: undefined }] : []),
  ]

  // Pré-processa a grade por coluna
  const grids = colunas.map(col => {
    const evts = eventosNoDia.filter(e =>
      col.id === "sem-sala" ? e.salaId === null : e.salaId === col.id
    )
    return buildGridColuna(evts)
  })

  const ALTURA_SLOT = 36 // px por slot de 30min

  return (
    <>
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-auto">
        <table className="text-sm border-collapse" style={{ minWidth: `${colunas.length * 200 + 80}px` }}>
          <thead>
            <tr className="bg-neutral-50">
              <th className="border border-neutral-200 px-3 py-2 text-left text-xs font-semibold text-neutral-500 w-20 sticky left-0 bg-neutral-50 z-10">
                Horário
              </th>
              {colunas.map(col => (
                <th
                  key={String(col.id)}
                  className="border border-neutral-200 px-3 py-2 text-center text-xs font-semibold text-neutral-700"
                  style={{ minWidth: "200px" }}
                >
                  <span>{col.tipo === "PRESENCIAL" ? "🏫" : col.tipo === "VIRTUAL" ? "💻" : "📋"}</span>{" "}
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((minutos, slotIdx) => {
              const isHoraCheia = minutos % 60 === 0
              return (
                <tr
                  key={minutos}
                  className={isHoraCheia ? "border-t-2 border-neutral-300" : ""}
                  style={{ height: `${ALTURA_SLOT}px` }}
                >
                  {/* Coluna de horário — só mostra label nas horas cheias */}
                  <td
                    className="border border-neutral-200 px-2 text-xs font-mono sticky left-0 bg-white z-10 align-top pt-1 whitespace-nowrap"
                    style={{ color: isHoraCheia ? "#374151" : "#9ca3af" }}
                  >
                    {isHoraCheia ? slotLabel(minutos) : <span className="text-neutral-300">·</span>}
                  </td>

                  {colunas.map((col, colIdx) => {
                    const celula = grids[colIdx][slotIdx]

                    if (celula.tipo === "ocupada") return null // coberta por rowSpan acima

                    if (celula.tipo === "vazia") {
                      return (
                        <td
                          key={String(col.id)}
                          className={`border border-neutral-100 ${isHoraCheia ? "border-t-neutral-300" : ""}`}
                        />
                      )
                    }

                    // tipo === "evento"
                    const { ev, rowSpan } = celula
                    const fmtHora = (d: Date) =>
                      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

                    return (
                      <td
                        key={String(col.id)}
                        rowSpan={rowSpan}
                        className={`border border-neutral-200 px-1 py-1 align-top ${isHoraCheia ? "border-t-neutral-300" : ""}`}
                        style={{ verticalAlign: "top" }}
                      >
                        <button
                          onClick={() => setSelected(ev)}
                          className="block w-full h-full text-left text-xs rounded-lg px-2 py-1.5 text-white font-medium hover:opacity-85 transition-opacity"
                          style={{
                            backgroundColor: STATUS_COLORS[ev.status] ?? "#6b7280",
                            minHeight: `${rowSpan * ALTURA_SLOT - 4}px`,
                          }}
                        >
                          <div className="font-semibold truncate">{ev.aluno}</div>
                          <div className="opacity-80 truncate">Prof. {ev.professor}</div>
                          <div className="opacity-70 mt-0.5">
                            {fmtHora(ev.start)}–{fmtHora(ev.end)}
                          </div>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selected && <ModalEvento ev={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

// ─── Tabela Resumo pivot (sala × horário) ────────────────────────────────────
const STATUS_BADGE_CLS: Record<string, string> = {
  PENDENTE:  "bg-amber-100 text-amber-700",
  AGENDADO:  "bg-blue-100 text-blue-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
}

function TabelaResumo({ eventos, salas }: { eventos: Evento[]; salas: Sala[] }) {
  const hoje   = new Date(); hoje.setHours(0,0,0,0)
  const em30   = new Date(hoje); em30.setDate(em30.getDate() + 30)

  const [dataIni, setDataIni]     = useState(hoje.toISOString().slice(0,10))
  const [dataFim, setDataFim]     = useState(em30.toISOString().slice(0,10))
  const [filtroStatus, setFiltroStatus] = useState("TODOS")
  const [selected, setSelected]   = useState<Evento | null>(null)

  const filtrados = useMemo(() => {
    let lista = eventos
    if (dataIni) lista = lista.filter(e => e.start >= new Date(dataIni + "T00:00:00"))
    if (dataFim) lista = lista.filter(e => e.start <= new Date(dataFim + "T23:59:59"))
    if (filtroStatus !== "TODOS") lista = lista.filter(e => e.status === filtroStatus)
    return lista.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [eventos, dataIni, dataFim, filtroStatus])

  // Colunas = salas que têm agendamentos + "sem sala" se houver
  const colunasIds   = salas.filter(s => filtrados.some(e => e.salaId === s.id)).map(s => s.id)
  const temSemSala   = filtrados.some(e => e.salaId === null)
  const colunas: (number | "sem-sala")[] = [...colunasIds, ...(temSemSala ? ["sem-sala" as const] : [])]

  // Agrupa por data → por hora → mapeia salaId → evento
  type Grupo = { key: string; label: string; slots: { hora: string; porSala: Map<number | "sem-sala", Evento> }[] }
  const grupos = useMemo((): Grupo[] => {
    const byDate = new Map<string, Map<string, Map<number | "sem-sala", Evento>>>()

    for (const ev of filtrados) {
      const dateKey = ev.start.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
      const horaKey = ev.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      const salaKey: number | "sem-sala" = ev.salaId ?? "sem-sala"

      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map())
      const byHora = byDate.get(dateKey)!
      if (!byHora.has(horaKey)) byHora.set(horaKey, new Map())
      byHora.get(horaKey)!.set(salaKey, ev)
    }

    return Array.from(byDate.entries()).map(([dateKey, byHora]) => ({
      key:   dateKey,
      label: dateKey,
      slots: Array.from(byHora.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hora, porSalaMap]) => ({ hora, porSala: porSalaMap })),
    }))
  }, [filtrados])

  if (colunas.length === 0) return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500">
      Nenhum agendamento no período selecionado.
    </div>
  )

  const salaLabel = (id: number | "sem-sala") => {
    if (id === "sem-sala") return { icon: "📋", name: "Sem sala" }
    const s = salas.find(x => x.id === id)
    return { icon: s?.type === "PRESENCIAL" ? "🏫" : "💻", name: s?.name ?? "?" }
  }

  return (
    <>
      {/* Filtros específicos do resumo */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs font-medium text-neutral-600">Período:</label>
        <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <span className="text-neutral-400 text-sm">até</span>
        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="TODOS">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="AGENDADO">Agendado</option>
          <option value="CONCLUIDO">Concluído</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <span className="text-xs text-neutral-400 ml-auto">{filtrados.length} aula(s)</span>
      </div>

      {/* Tabela pivot */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-auto">
        <table className="text-sm border-collapse" style={{ minWidth: `${colunas.length * 220 + 140}px` }}>
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 w-32 sticky left-0 bg-neutral-50 z-10 whitespace-nowrap">
                Data / Hora
              </th>
              {colunas.map(id => {
                const { icon, name } = salaLabel(id)
                return (
                  <th key={String(id)} className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 border-l border-neutral-200"
                    style={{ minWidth: "220px" }}>
                    {icon} {name}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {grupos.map(grupo => (
              <>
                {/* Linha de cabeçalho da data */}
                <tr key={"hdr-" + grupo.key} className="bg-primary-50 border-y border-primary-100">
                  <td colSpan={colunas.length + 1} className="px-4 py-2 text-xs font-bold text-primary-700 capitalize sticky left-0">
                    {grupo.label}
                  </td>
                </tr>
                {/* Linhas de horário */}
                {grupo.slots.map(({ hora, porSala }) => (
                  <tr key={grupo.key + hora} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                    <td className="px-4 py-2 text-xs font-mono font-semibold text-neutral-600 sticky left-0 bg-white whitespace-nowrap">
                      {hora}
                    </td>
                    {colunas.map(id => {
                      const ev = porSala.get(id)
                      return (
                        <td key={String(id)} className="px-2 py-1.5 border-l border-neutral-100 align-top">
                          {ev ? (
                            <button onClick={() => setSelected(ev)}
                              className="w-full text-left rounded-xl p-2 hover:opacity-80 transition-opacity text-white text-xs"
                              style={{ backgroundColor: STATUS_COLORS[ev.status] ?? "#6b7280" }}>
                              <p className="font-semibold truncate">{ev.aluno}</p>
                              <p className="opacity-80 truncate">Prof. {ev.professor}</p>
                              <p className="opacity-70 mt-0.5">{ev.title.split(" — ")[0]}</p>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_BADGE_CLS[ev.status] ?? ""}`}>
                                {ev.status}
                              </span>
                            </button>
                          ) : (
                            <span className="text-neutral-200 text-xs">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <ModalEvento ev={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

// ─── Resumo de aulas ──────────────────────────────────────────────────────────
function ResumoAulas({ eventos, salas }: { eventos: Evento[]; salas: Sala[] }) {
  const agendados  = eventos.filter(e => e.status === "AGENDADO")
  const concluidos = eventos.filter(e => e.status === "CONCLUIDO")

  const porSala = salas.map(s => ({
    sala: s,
    total: eventos.filter(e => e.salaId === s.id).length,
    agendados: eventos.filter(e => e.salaId === s.id && e.status === "AGENDADO").length,
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  const professorCount: Record<string, number> = {}
  eventos.forEach(e => { professorCount[e.professor] = (professorCount[e.professor] ?? 0) + 1 })
  const topProfessores = Object.entries(professorCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6">
      <h2 className="text-lg font-bold text-neutral-900">Resumo de Aulas</h2>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: eventos.length, color: "bg-neutral-100 text-neutral-700" },
          { label: "Agendadas", value: agendados.length, color: "bg-blue-50 text-blue-700" },
          { label: "Concluídas", value: concluidos.length, color: "bg-green-50 text-green-700" },
          { label: "Sem sala", value: eventos.filter(e => !e.salaId).length, color: "bg-amber-50 text-amber-700" },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-4 text-center`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por sala */}
        {porSala.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">Aulas por sala</h3>
            <div className="space-y-2">
              {porSala.map(({ sala, total, agendados }) => (
                <div key={sala.id} className="flex items-center gap-3">
                  <span className="text-sm">{sala.type === "PRESENCIAL" ? "🏫" : "💻"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">{sala.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="h-1.5 bg-neutral-100 rounded-full flex-1 overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min((total / Math.max(...porSala.map(x => x.total))) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs text-neutral-500 whitespace-nowrap">{total} total · {agendados} agendadas</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top professores */}
        {topProfessores.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">Professores (top aulas)</h3>
            <div className="space-y-2">
              {topProfessores.map(([prof, count]) => (
                <div key={prof} className="flex items-center justify-between">
                  <p className="text-sm text-neutral-700 truncate">{prof}</p>
                  <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold ml-2 whitespace-nowrap">{count} aula{count !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function CalendarioAulas({ eventos, salas }: { eventos: Evento[]; salas: Sala[] }) {
  const [busca, setBusca] = useState("")
  const [filtroSalaId, setFiltroSalaId] = useState<number | "todas" | "sem-sala">("todas")
  const [modo, setModo] = useState<"geral" | "por-sala" | "grade" | "resumo">("geral")
  const [dataGrade, setDataGrade] = useState<string>(new Date().toISOString().slice(0, 10))

  const eventosFiltrados = useMemo(() => {
    let lista = eventos

    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(e =>
        e.aluno.toLowerCase().includes(q) ||
        e.professor.toLowerCase().includes(q) ||
        (e.sala?.toLowerCase().includes(q) ?? false) ||
        e.title.toLowerCase().includes(q)
      )
    }

    if (filtroSalaId !== "todas") {
      lista = filtroSalaId === "sem-sala"
        ? lista.filter(e => e.salaId === null)
        : lista.filter(e => e.salaId === filtroSalaId)
    }

    return lista
  }, [eventos, busca, filtroSalaId])

  const salasComAulas = salas.filter(s => eventos.some(e => e.salaId === s.id))
  const eventosSemSala = eventos.filter(e => e.salaId === null)

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Legenda */}
          <div className="flex gap-4 text-xs">
            {[{ cor: "bg-blue-600", label: "Agendado" }, { cor: "bg-green-600", label: "Concluído" }, { cor: "bg-red-600", label: "Cancelado" }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-full ${l.cor}`} />
                <span className="text-neutral-600">{l.label}</span>
              </div>
            ))}
          </div>
          <div className="flex-1" />
          {/* Modo */}
          <div className="flex rounded-lg overflow-hidden border border-neutral-200 text-xs font-medium">
            {([["geral", "Geral"], ["por-sala", "Por sala"], ["grade", "Grade horária"], ["resumo", "Resumo por sala"]] as const).map(([val, lbl]) => (
              <button key={val} onClick={() => setModo(val)}
                className={`px-3 py-1.5 transition-colors ${modo === val ? "bg-primary-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Busca + filtros */}
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Buscar por aluno, professor ou sala..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="flex-1 min-w-48 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {(modo === "geral" || modo === "por-sala") && salas.length > 0 && (
            <select
              value={String(filtroSalaId)}
              onChange={e => {
                const v = e.target.value
                setFiltroSalaId(v === "todas" ? "todas" : v === "sem-sala" ? "sem-sala" : Number(v))
              }}
              className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="todas">Todas as salas</option>
              {salas.map(s => (
                <option key={s.id} value={String(s.id)}>{s.type === "PRESENCIAL" ? "🏫" : "💻"} {s.name}</option>
              ))}
              {eventosSemSala.length > 0 && <option value="sem-sala">Sem sala definida</option>}
            </select>
          )}
          {modo === "grade" && (
            <input type="date" value={dataGrade} onChange={e => setDataGrade(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          )}
        </div>

        {busca && (
          <p className="text-xs text-neutral-500">{eventosFiltrados.length} resultado(s) para "{busca}"</p>
        )}
      </div>

      {/* Visão geral */}
      {modo === "geral" && <CalendarioSingle eventos={eventosFiltrados} />}

      {/* Visão por sala */}
      {modo === "por-sala" && (
        <div className="space-y-8">
          {salasComAulas.filter(s => filtroSalaId === "todas" || filtroSalaId === s.id).map(sala => {
            const evSala = eventosFiltrados.filter(e => e.salaId === sala.id)
            if (evSala.length === 0) return null
            return (
              <div key={sala.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{sala.type === "PRESENCIAL" ? "🏫" : "💻"}</span>
                  <h2 className="text-lg font-bold text-neutral-900">{sala.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sala.type === "PRESENCIAL" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {sala.type === "PRESENCIAL" ? "Presencial" : "Virtual"}
                  </span>
                  <span className="text-xs text-neutral-400">{evSala.length} aula(s)</span>
                </div>
                <CalendarioSingle eventos={evSala} />
              </div>
            )
          })}
          {(filtroSalaId === "todas" || filtroSalaId === "sem-sala") && eventosFiltrados.filter(e => !e.salaId).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📋</span>
                <h2 className="text-lg font-bold text-neutral-900">Sem sala definida</h2>
                <span className="text-xs text-neutral-400">{eventosFiltrados.filter(e => !e.salaId).length} aula(s)</span>
              </div>
              <CalendarioSingle eventos={eventosFiltrados.filter(e => !e.salaId)} />
            </div>
          )}
        </div>
      )}

      {/* Grade por sala/horário */}
      {modo === "grade" && (
        <GradeSalaHorario
          eventos={eventosFiltrados}
          salas={salas}
          data={new Date(dataGrade + "T12:00:00")}
        />
      )}

      {/* Resumo pivot por sala */}
      {modo === "resumo" && (
        <TabelaResumo eventos={eventosFiltrados} salas={salas} />
      )}

      {/* Painel de resumo estatístico */}
      {modo !== "resumo" && <ResumoAulas eventos={eventosFiltrados} salas={salas} />}
    </div>
  )
}
