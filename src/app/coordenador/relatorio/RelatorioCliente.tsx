"use client"

import { useState, useMemo } from "react"

type Agendamento = {
  id: string
  dataHora: string
  duracaoMinutos: number
  disciplina: string
  status: string
  aluno: string
  alunoEmail: string
  professor: string
  sala: string | null
  salaTipo: string | null
  observacoes: string | null
}

const STATUS_BADGE: Record<string, string> = {
  PENDENTE:  "bg-amber-100 text-amber-700",
  AGENDADO:  "bg-blue-100 text-blue-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function RelatorioCliente({
  agendamentos,
  geradoEm,
}: {
  agendamentos: Agendamento[]
  geradoEm: string
}) {
  const [busca, setBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")

  const filtrados = useMemo(() => {
    let lista = agendamentos

    if (filtroStatus !== "TODOS") lista = lista.filter(a => a.status === filtroStatus)

    if (dataInicio) {
      const d = new Date(dataInicio + "T00:00:00")
      lista = lista.filter(a => new Date(a.dataHora) >= d)
    }
    if (dataFim) {
      const d = new Date(dataFim + "T23:59:59")
      lista = lista.filter(a => new Date(a.dataHora) <= d)
    }

    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(a =>
        a.aluno.toLowerCase().includes(q) ||
        a.professor.toLowerCase().includes(q) ||
        a.disciplina.toLowerCase().includes(q) ||
        (a.sala?.toLowerCase().includes(q) ?? false) ||
        a.alunoEmail.toLowerCase().includes(q)
      )
    }

    return lista
  }, [agendamentos, busca, filtroStatus, dataInicio, dataFim])

  const totalHoras = filtrados.reduce((acc, a) => acc + a.duracaoMinutos / 60, 0)
  const agendados  = filtrados.filter(a => a.status === "AGENDADO").length
  const concluidos = filtrados.filter(a => a.status === "CONCLUIDO").length

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Cabeçalho — visível na tela e no PDF */}
      <div className="flex flex-wrap items-start justify-between gap-4 print:block">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Relatório de Aulas</h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Gerado em {new Date(geradoEm).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-primary-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-colors text-sm print:hidden"
        >
          Exportar PDF
        </button>
      </div>

      {/* Filtros — ocultos no PDF */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3 print:hidden">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Buscar por aluno, professor, sala, disciplina..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="flex-1 min-w-48 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="TODOS">Todos os status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="AGENDADO">Agendado</option>
            <option value="CONCLUIDO">Concluído</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-xs text-neutral-600 font-medium">Período:</label>
          <input
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="text-neutral-400 text-sm">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {(dataInicio || dataFim || busca || filtroStatus !== "TODOS") && (
            <button
              onClick={() => { setBusca(""); setFiltroStatus("TODOS"); setDataInicio(""); setDataFim("") }}
              className="text-xs text-neutral-500 hover:text-neutral-700 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de aulas", value: filtrados.length, sub: "" },
          { label: "Agendadas", value: agendados, sub: "" },
          { label: "Concluídas", value: concluidos, sub: "" },
          { label: "Total de horas", value: totalHoras.toFixed(1) + "h", sub: "" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-neutral-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {["Data/Hora", "Aluno", "Professor", "Disciplina", "Sala", "Duração", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-neutral-400">Nenhum agendamento encontrado com os filtros aplicados.</td>
                </tr>
              ) : (
                filtrados.map(a => (
                  <tr key={a.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-neutral-800">{fmtData(a.dataHora)}</p>
                      <p className="text-xs text-neutral-500">{new Date(a.dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-800">{a.aluno}</p>
                      <p className="text-xs text-neutral-400 truncate max-w-40">{a.alunoEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-800 whitespace-nowrap">{a.professor}</td>
                    <td className="px-4 py-3 text-neutral-700">{a.disciplina}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {a.sala
                        ? <span>{a.salaTipo === "PRESENCIAL" ? "🏫" : "💻"} {a.sala}</span>
                        : <span className="text-neutral-400 italic text-xs">Não def.</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-600">{a.duracaoMinutos}min</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[a.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-neutral-400 text-center print:block hidden">
        Portal Quebra Cabeças · Relatório gerado em {new Date(geradoEm).toLocaleString("pt-BR")} · {filtrados.length} aula(s)
      </p>

      {/* CSS de impressão */}
      <style>{`
        @media print {
          body { font-size: 11px; }
          @page { margin: 1.5cm; size: A4 landscape; }
        }
      `}</style>
    </main>
  )
}
